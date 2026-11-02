import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useExternalLinkStore = defineStore('ExternalLink', () => {
    const externalLinkDialog = ref({
        visible: false,
        link: ''
    });

    /**
     * Shows the external-link confirmation for the supplied URL.
     *
     * @param {string} link
     */
    function showExternalLinkDialog(link: string) {
        externalLinkDialog.value = {
            visible: true,
            link: String(link)
        };
    }

    return {
        externalLinkDialog,
        showExternalLinkDialog
    };
});
