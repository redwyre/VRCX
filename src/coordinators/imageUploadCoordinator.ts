import { toast } from 'vue-sonner';

import { $throw } from '../services/request';
import { AppDebug } from '../services/appConfig';
import { extractFileId } from '../shared/utils';
import { imageRequest } from '../api';

function resolveMessage(message: () => any) {
    if (typeof message === 'function') {
        return message();
    }
    return message;
}

function getInputElement(selector: string | (() => any)) {
    if (!selector) {
        return null;
    }
    if (typeof selector === 'function') {
        return selector();
    }
    if (typeof selector === 'string') {
        return document.querySelector(selector);
    }
    return selector;
}

export function handleImageUploadInput(event: any, options = {}) {
    const {
        inputSelector,
        // 20MB
        maxSize = 20000000,
        acceptPattern = /image.*/,
        tooLargeMessage,
        invalidTypeMessage,
        onClear
    }: any = options;

    const clearInput = () => {
        onClear?.();
        const input = getInputElement(inputSelector);
        if (input) {
            input.value = '';
        }
    };

    const files = event?.target?.files || event?.dataTransfer?.files;
    if (!files || files.length === 0) {
        clearInput();
        return { file: null, clearInput };
    }

    const file = files[0];
    if (file.size >= maxSize) {
        if (tooLargeMessage) {
            toast.error(resolveMessage(tooLargeMessage));
        }
        clearInput();
        return { file: null, clearInput };
    }

    let acceptRegex = null;
    if (acceptPattern) {
        acceptRegex = acceptPattern instanceof RegExp ? acceptPattern : new RegExp(acceptPattern);
    }

    if (acceptRegex && !acceptRegex.test(file.type)) {
        if (invalidTypeMessage) {
            toast.error(resolveMessage(invalidTypeMessage));
        }
        clearInput();
        return { file: null, clearInput };
    }

    return { file, clearInput };
}

/**
 * @param {string} base64Data - Base64 encoded image
 * @returns {Promise<string>} Resized base64 encoded image
 */
export async function resizeImageToFitLimits(base64Data: string) {
    // frontend limit check = 20MB
return (AppApi as any).ResizeImageToFitLimits(base64Data);
}

/**
 * Upload image through AWS
 *
 * @param {'avatar' | 'world'} type
 * @param {object} opts
 * @param {string} opts.entityId - Avatar or world id
 * @param {string} opts.imageUrl - Current imageUrl on the entity
 * @param {string} opts.base64File - Base64 encoded image data
 * @param {Blob} opts.blob - The original blob (used for file size)
 */
export async function uploadImageLegacy(type: 'avatar' | 'world', { entityId, imageUrl, base64File, blob }: {
    entityId: string;
    imageUrl: string;
    base64File: string;
    blob: Blob;
}) {
    const apiMap = {
        avatar: {
            uploadImage: imageRequest.uploadAvatarImage,
            fileStart: imageRequest.uploadAvatarImageFileStart,
            fileFinish: imageRequest.uploadAvatarImageFileFinish,
            sigStart: imageRequest.uploadAvatarImageSigStart,
            sigFinish: imageRequest.uploadAvatarImageSigFinish,
            setImage: imageRequest.setAvatarImage
        },
        world: {
            uploadImage: imageRequest.uploadWorldImage,
            fileStart: imageRequest.uploadWorldImageFileStart,
            fileFinish: imageRequest.uploadWorldImageFileFinish,
            sigStart: imageRequest.uploadWorldImageSigStart,
            sigFinish: imageRequest.uploadWorldImageSigFinish,
            setImage: imageRequest.setWorldImage
        }
    };
    const api = apiMap[type];

    const fileMd5 = await (AppApi as any).MD5File(base64File);
    const fileSizeInBytes = blob.size;
    const base64SignatureFile = await (AppApi as any).SignFile(base64File);
    const signatureMd5 = await (AppApi as any).MD5File(base64SignatureFile);
    const signatureSizeInBytes = parseInt(await (AppApi as any).FileLength(base64SignatureFile), 10);
    const fileId = extractFileId(imageUrl);

    // imageInit
    const uploadRes = await api.uploadImage({ fileMd5, fileSizeInBytes, signatureMd5, signatureSizeInBytes }, fileId);
    const uploadedFileId = uploadRes.json.id;
    const fileVersion = uploadRes.json.versions[uploadRes.json.versions.length - 1].version;

    // imageFileStart
    const fileStartRes = await api.fileStart({
        fileId: uploadedFileId,
        fileVersion
    });

    // uploadImageFileAWS
    const fileAwsRes = await webApiService.execute({
        url: fileStartRes.json.url,
        uploadFilePUT: true,
        fileData: base64File,
        fileMIME: 'image/png',
        fileMD5: fileMd5
    });
    if (fileAwsRes.status !== 200) {
        $throw(fileAwsRes.status, `${type} image upload failed`, fileStartRes.json.url);
    }

    // imageFileFinish
    await api.fileFinish({ fileId: uploadedFileId, fileVersion });

    // imageSigStart
    const sigStartRes = await api.sigStart({
        fileId: uploadedFileId,
        fileVersion
    });

    // uploadImageSigAWS
    const sigAwsRes = await webApiService.execute({
        url: sigStartRes.json.url,
        uploadFilePUT: true,
        fileData: base64SignatureFile,
        fileMIME: 'application/x-rsync-signature',
        fileMD5: signatureMd5
    });
    if (sigAwsRes.status !== 200) {
        $throw(sigAwsRes.status, `${type} image upload failed`, sigStartRes.json.url);
    }

    // imageSigFinish
    await api.sigFinish({ fileId: uploadedFileId, fileVersion });

    // imageSet
    const newImageUrl = `${AppDebug.endpointDomain}/file/${uploadedFileId}/${fileVersion}/file`;
    const setRes = await api.setImage({ id: entityId, imageUrl: newImageUrl });
    if (setRes.json.imageUrl !== newImageUrl) {
        $throw(0, `${type} image change failed`, newImageUrl);
    }
}
