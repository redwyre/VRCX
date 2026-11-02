import { ref } from 'vue';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

const MAX_PREVIEW_SIZE = 800;

/**
 * @param {HTMLImageElement | HTMLCanvasElement} img
 * @param {number} angleDeg
 * @param {boolean} flipH
 * @param {boolean} flipV
 * @returns {HTMLCanvasElement}
 */
export function applyTransforms(img: HTMLImageElement | HTMLCanvasElement, angleDeg: number, flipH: boolean, flipV: boolean) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(angleRad));
    const absSin = Math.abs(Math.sin(angleRad));

    const rotW = Math.round(img.width * absCos + img.height * absSin);
    const rotH = Math.round(img.width * absSin + img.height * absCos);

    const cvs = document.createElement('canvas');
    cvs.width = rotW;
    cvs.height = rotH;
    const ctx = cvs.getContext('2d');





    ctx.translate(rotW / 2, rotH / 2);




    ctx.rotate(angleRad);




    if (flipH) ctx.scale(-1, 1);




    if (flipV) ctx.scale(1, -1);




    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    return cvs;
}

/**
 * @param {HTMLImageElement | HTMLCanvasElement} originalImage
 * @param {number} previewScale
 * @param {{ coordinates: object; image: object }} cropperResult
 * @param {File} [originalFile]
 * @returns {Promise<Blob | null>}
 */
export function cropImage(originalImage: HTMLImageElement | HTMLCanvasElement, previewScale: number, cropperResult: { coordinates: object; image: object; }, originalFile?: File) {
    if (!cropperResult?.coordinates || !originalImage) {
        return Promise.resolve(null);
    }

    const { coordinates } = cropperResult;
    const scale = previewScale;
    const transforms = (cropperResult.image as any)?.transforms || {};
    const angle = transforms.rotate || 0;
    const flipH = transforms.flip?.horizontal || false;
    const flipV = transforms.flip?.vertical || false;
    const hasTransform = angle !== 0 || flipH || flipV;

    const cropX = Math.round((coordinates as any).left / scale);
    const cropY = Math.round((coordinates as any).top / scale);
    const cropW = Math.round((coordinates as any).width / scale);
    const cropH = Math.round((coordinates as any).height / scale);

    if (!hasTransform) {
        const noCrop =
            cropX <= 1 &&
            cropY <= 1 &&
            Math.abs(cropW - originalImage.width) <= 1 &&
            Math.abs(cropH - originalImage.height) <= 1;
        if (noCrop && originalFile) {
            return Promise.resolve(originalFile);
        }
    }

    const source = hasTransform ? applyTransforms(originalImage, angle, flipH, flipV) : originalImage;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const ctx = cropCanvas.getContext('2d');





    ctx.drawImage(source, -cropX, -cropY);

    return new Promise((resolve) => {
        cropCanvas.toBlob(resolve, 'image/png');
    });
}

export function useImageCropper() {
    const { t } = useI18n();

    const cropperRef = ref(null);
    const cropperImageSrc = ref('');
    const originalImage = ref(null);
    const previewScale = ref(1);

    function resetCropState() {
        cropperImageSrc.value = '';
        originalImage.value = null;
        previewScale.value = 1;
    }

    /**
     * Downscale for interactive preview, keep original for final crop.
     *
     * @param {File} file
     */
    function loadImageForCrop(file: File) {
        const r = new FileReader();
        r.onload = () => {
            const img = new Image();
            img.onload = () => {




                originalImage.value = img;
                if (img.width > MAX_PREVIEW_SIZE || img.height > MAX_PREVIEW_SIZE) {
                    const scale = Math.min(MAX_PREVIEW_SIZE / img.width, MAX_PREVIEW_SIZE / img.height);
                    previewScale.value = scale;
                    const cvs = document.createElement('canvas');
                    cvs.width = Math.round(img.width * scale);
                    cvs.height = Math.round(img.height * scale);
                    const ctx = cvs.getContext('2d');




                    ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
                    cropperImageSrc.value = cvs.toDataURL('image/jpeg', 0.9);
                } else {
                    previewScale.value = 1;





                    cropperImageSrc.value = r.result;
                }
            };
            img.onerror = () => {
                resetCropState();
            };





            img.src = r.result;
        };
        r.onerror = () => {
            resetCropState();
            toast.error(t('message.file.not_image'));
        };
        r.readAsDataURL(file);
    }

    /**
     * @param {File} [originalFile]
     * @returns {Promise<Blob | null>}
     */
    function getCroppedBlob(originalFile?: File) {
        const result = (cropperRef.value as any)?.getResult();




        return cropImage(originalImage.value, previewScale.value, result, originalFile);
    }

    return {
        cropperRef,
        cropperImageSrc,
        resetCropState,
        loadImageForCrop,
        getCroppedBlob
    };
}
