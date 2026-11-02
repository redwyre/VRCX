import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

export type ConfirmResult = {
    ok: boolean;
    reason: 'ok' | 'cancel' | 'dismiss' | 'replaced';
    checked: boolean;
};

export type ConfirmOptions = {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    checkboxLabel?: string;
    dismissible?: boolean;
    destructive?: boolean;
};

export type AlertOptions = {
    title: string;
    description: string;
    confirmText?: string;
    dismissible?: boolean;
    destructive?: boolean;
};

export type PromptResult = {
    ok: boolean;
    reason: 'ok' | 'cancel' | 'dismiss' | 'replaced';
    value: string;
};

export type PromptOptions = {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    inputValue?: string;
    inputType?: string;
    pattern?: RegExp | string;
    errorMessage?: string;
    dismissible?: boolean;
};

export type OtpPromptOptions = {
    title: string;
    description: string;
    mode: 'totp' | 'emailOtp' | 'otp';
    confirmText?: string;
    cancelText?: string;
    dismissible?: boolean;
};

export const useModalStore = defineStore('Modal', () => {
    const { t } = useI18n();

    const alertOpen = ref(false);
    const alertMode = ref('confirm'); // 'confirm' | 'alert'
    const alertTitle = ref('');
    const alertDescription = ref('');
    const alertOkText = ref('');
    const alertCancelText = ref('');
    const alertDismissible = ref(true);
    const alertDestructive = ref(false);
    const alertCheckboxLabel = ref('');
    const alertChecked = ref(false);

    const promptOpen = ref(false);
    const promptTitle = ref('');
    const promptDescription = ref('');
    const promptOkText = ref('');
    const promptCancelText = ref('');
    const promptDismissible = ref(true);
    const promptInputValue = ref('');
    const promptInputType = ref('text');
    const promptPattern = ref(null);
    const promptErrorMessage = ref('');

    const otpOpen = ref(false);
    const otpTitle = ref('');
    const otpDescription = ref('');
    const otpOkText = ref('');
    const otpCancelText = ref('');
    const otpDismissible = ref(true);
    const otpMode = ref('totp'); // 'totp' | 'emailOtp' | 'otp'

    /** @type {{ resolve: ((result: ConfirmResult) => void) | null } | null} */
    let pending: { resolve: ((result: ConfirmResult) => void) | null; } | null = null;
    /** @type {{ resolve: ((result: PromptResult) => void) | null } | null} */
    let pendingPrompt: { resolve: ((result: PromptResult) => void) | null; } | null = null;
    /** @type {{ resolve: ((result: PromptResult) => void) | null } | null} */
    let pendingOtp: { resolve: ((result: PromptResult) => void) | null; } | null = null;

    function closeDialog() {
        alertOpen.value = false;
    }

    function closePromptDialog() {
        promptOpen.value = false;
    }

    /**
     * @param {'ok' | 'cancel' | 'dismiss' | 'replaced'} reason
     */
    function finish(reason: 'ok' | 'cancel' | 'dismiss' | 'replaced') {
        const resolve = pending?.resolve;
        pending = null;
        closeDialog();
        if (resolve) resolve({ ok: reason === 'ok', reason, checked: alertChecked.value });
    }

    /**
     * @param {'ok' | 'cancel' | 'dismiss' | 'replaced'} reason
     */
    function finishWithoutClosing(reason: 'ok' | 'cancel' | 'dismiss' | 'replaced') {
        const resolve = pending?.resolve;
        pending = null;
        if (resolve) resolve({ ok: reason === 'ok', reason, checked: alertChecked.value });
    }

    /**
     * @param {'ok' | 'cancel' | 'dismiss' | 'replaced'} reason
     * @param {string} value
     */
    function finishPrompt(reason: 'ok' | 'cancel' | 'dismiss' | 'replaced', value: string) {
        const resolve = pendingPrompt?.resolve;
        pendingPrompt = null;
        closePromptDialog();
        if (resolve) resolve({ ok: reason === 'ok', reason, value });
    }

    /**
     * @param {'ok' | 'cancel' | 'dismiss' | 'replaced'} reason
     * @param {string} value
     */
    function finishPromptWithoutClosing(reason: 'ok' | 'cancel' | 'dismiss' | 'replaced', value: string) {
        const resolve = pendingPrompt?.resolve;
        pendingPrompt = null;
        if (resolve) resolve({ ok: reason === 'ok', reason, value });
    }

    /**
     * @param {'confirm' | 'alert'} mode
     * @param {any} options
     */
    function openBase(mode: 'confirm' | 'alert', options: any) {
        if (pending) {
            // old dialog is force-finished
            // do not call closeDialog here because we are about to open a new one
            finishWithoutClosing('replaced');
        }

        alertMode.value = mode;
        alertTitle.value = options.title;
        alertDescription.value = options.description;
        alertDismissible.value = options.dismissible !== false;
        alertDestructive.value = options.destructive === true;
        alertCheckboxLabel.value = options.checkboxLabel || '';
        alertChecked.value = false;

        if (mode === 'alert') {
            alertOkText.value = options.confirmText || t('dialog.alertdialog.ok');
            alertCancelText.value = '';
        } else {
            alertOkText.value = options.confirmText || t('dialog.alertdialog.confirm');
            alertCancelText.value = options.cancelText || t('dialog.alertdialog.cancel');
        }

        alertOpen.value = true;

        return new Promise((resolve) => {
            pending = { resolve };
        });
    }

    /**
     * @param {PromptOptions} options
     * @returns {Promise<PromptResult>}
     */
    function openPrompt(options: PromptOptions) {
        if (pendingPrompt) {
            finishPromptWithoutClosing('replaced', promptInputValue.value);
        }

        const inputValue = options.inputValue ?? '';
        const inputValueCopy = typeof inputValue === 'string' ? inputValue.slice() : String(inputValue);

        promptTitle.value = options.title;
        promptDescription.value = options.description;
        promptDismissible.value = options.dismissible !== false;
        promptInputValue.value = inputValueCopy;
        promptInputType.value = options.inputType || 'text';




        promptPattern.value = options.pattern ?? null;
        promptErrorMessage.value = options.errorMessage || t('dialog.prompt.input_invalid');

        promptOkText.value = options.confirmText || t('dialog.alertdialog.confirm');
        promptCancelText.value = options.cancelText || t('dialog.alertdialog.cancel');

        promptOpen.value = true;

        return new Promise((resolve) => {
            pendingPrompt = { resolve };
        });
    }

    /**
     * Confirm: always resolve({ok, reason})
     *
     * @param {ConfirmOptions} options
     * @returns {Promise<ConfirmResult>}
     */
    function confirm(options: ConfirmOptions) {
        return openBase('confirm', options);
    }

    /**
     * Alert: always resolve({ok:true, reason:'ok'}) when closed
     *
     * @param {AlertOptions} options
     * @returns {Promise<ConfirmResult>}
     */
    function alert(options: AlertOptions) {
        return openBase('alert', options);
    }

    /**
     * Prompt: always resolve({ok, reason, value})
     *
     * @param {PromptOptions} options
     * @returns {Promise<PromptResult>}
     */
    function prompt(options: PromptOptions) {
        return openPrompt(options);
    }

    function handleOk() {
        if (!pending) return;
        finish('ok');
    }

    function handlePromptOk(value: any) {
        if (!pendingPrompt) return;
        finishPrompt('ok', value ?? '');
    }

    function handleCancel() {
        if (!pending) return;

        // alert has no cancel semantics
        if (alertMode.value === 'alert') {
            finish('ok');
            return;
        }

        finish('cancel');
    }

    function handlePromptCancel(value: any) {
        if (!pendingPrompt) return;
        finishPrompt('cancel', value ?? '');
    }

    function handleDismiss() {
        if (!pending) return;
        if (!alertDismissible.value) return;

        // alert: dismiss also means done
        if (alertMode.value === 'alert') {
            finish('ok');
            return;
        }

        finish('dismiss');
    }

    function handlePromptDismiss(value: any) {
        if (!pendingPrompt) return;
        if (!promptDismissible.value) return;
        finishPrompt('dismiss', value ?? '');
    }

    function setAlertOpen(open: any) {
        alertOpen.value = !!open;
    }

    function setPromptOpen(open: any) {
        promptOpen.value = !!open;
    }

    // --- OTP dialog ---

    function closeOtpDialog() {
        otpOpen.value = false;
    }

    /**
     * @param {'ok' | 'cancel' | 'dismiss' | 'replaced'} reason
     * @param {string} value
     */
    function finishOtp(reason: 'ok' | 'cancel' | 'dismiss' | 'replaced', value: string) {
        const resolve = pendingOtp?.resolve;
        pendingOtp = null;
        closeOtpDialog();
        if (resolve) resolve({ ok: reason === 'ok', reason, value });
    }

    /**
     * @param {'ok' | 'cancel' | 'dismiss' | 'replaced'} reason
     * @param {string} value
     */
    function finishOtpWithoutClosing(reason: 'ok' | 'cancel' | 'dismiss' | 'replaced', value: string) {
        const resolve = pendingOtp?.resolve;
        pendingOtp = null;
        if (resolve) resolve({ ok: reason === 'ok', reason, value });
    }

    /**
     * @param {OtpPromptOptions} options
     * @returns {Promise<PromptResult>}
     */
    function openOtp(options: OtpPromptOptions) {
        if (pendingOtp) {
            finishOtpWithoutClosing('replaced', '');
        }

        otpTitle.value = options.title;
        otpDescription.value = options.description;
        otpDismissible.value = options.dismissible !== false;
        otpMode.value = options.mode || 'totp';

        otpOkText.value = options.confirmText || t('dialog.alertdialog.confirm');
        otpCancelText.value = options.cancelText || t('dialog.alertdialog.cancel');

        otpOpen.value = true;

        return new Promise((resolve) => {
            pendingOtp = { resolve };
        });
    }

    /**
     * OtpPrompt: always resolve({ok, reason, value})
     *
     * @param {OtpPromptOptions} options
     * @returns {Promise<PromptResult>}
     */
    function otpPrompt(options: OtpPromptOptions) {
        return openOtp(options);
    }

    function handleOtpOk(value: any) {
        if (!pendingOtp) return;
        finishOtp('ok', value ?? '');
    }

    function handleOtpCancel(value: any) {
        if (!pendingOtp) return;
        finishOtp('cancel', value ?? '');
    }

    function handleOtpDismiss(value: any) {
        if (!pendingOtp) return;
        if (!otpDismissible.value) return;
        finishOtp('dismiss', value ?? '');
    }

    function setOtpOpen(open: any) {
        otpOpen.value = !!open;
    }

    return {
        alertOpen,
        alertMode,
        alertTitle,
        alertDescription,
        alertOkText,
        alertCancelText,
        alertDismissible,
        alertDestructive,
        alertCheckboxLabel,
        alertChecked,
        promptOpen,
        promptTitle,
        promptDescription,
        promptOkText,
        promptCancelText,
        promptDismissible,
        promptInputValue,
        promptInputType,
        promptPattern,
        promptErrorMessage,
        otpOpen,
        otpTitle,
        otpDescription,
        otpOkText,
        otpCancelText,
        otpDismissible,
        otpMode,

        confirm,
        alert,
        prompt,
        otpPrompt,

        handleOk,
        handleCancel,
        handleDismiss,
        handlePromptOk,
        handlePromptCancel,
        handlePromptDismiss,
        setAlertOpen,
        setPromptOpen,
        handleOtpOk,
        handleOtpCancel,
        handleOtpDismiss,
        setOtpOpen
    };
});
