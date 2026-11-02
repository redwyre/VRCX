/**
 * @param {object} print
 * @returns
 */
function getPrintFileName(print: object) {
    const authorName = (print as any).authorName;
    // fileDate format: 2024-11-03_16-14-25.757
    const createdAt = getPrintLocalDate(print);
    const fileNameDate = createdAt.toISOString().replace(/:/g, '-').replace(/T/g, '_').replace(/Z/g, '');
    const fileName = `${authorName}_${fileNameDate}_${(print as any).id}.png`;
    return fileName;
}

/**
 * @param {object} print
 * @returns
 */
function getPrintLocalDate(print: object) {
    if ((print as any).createdAt) {
        const createdAt = new Date((print as any).createdAt);
        // cursed convert to local time
        createdAt.setMinutes(createdAt.getMinutes() - createdAt.getTimezoneOffset());
        return createdAt;
    }
    if ((print as any).timestamp) {
        return new Date((print as any).timestamp);
    }

    const createdAt = new Date();
    // cursed convert to local time
    createdAt.setMinutes(createdAt.getMinutes() - createdAt.getTimezoneOffset());
    return createdAt;
}

/**
 * @param {object} emoji
 */
function getEmojiFileName(emoji: object) {
    if ((emoji as any).frames) {
        const loopStyle = (emoji as any).loopStyle || 'linear';
        return `${(emoji as any).name}_${(emoji as any).animationStyle}animationStyle_${(emoji as any).frames}frames_${(emoji as any).framesOverTime}fps_${loopStyle}loopStyle.png`;
    } else {
        return `${(emoji as any).name}_${(emoji as any).animationStyle}animationStyle.png`;
    }
}

/**
 * @param {string} url
 * @param {number} fps
 * @param {number} frameCount
 * @param {string} loopStyle
 * @param size
 */
function generateEmojiStyle(url: string, fps: number, frameCount: number, loopStyle: string, size: number) {
    let framesPerLine = 2;
    if (frameCount > 4) framesPerLine = 4;
    if (frameCount > 16) framesPerLine = 8;
    const animationDurationMs = (1000 / fps) * frameCount;
    const frameSize = 1024 / framesPerLine;
    const scale = 100 / (frameSize / size);
    const animStyle = loopStyle === 'pingpong' ? 'alternate' : 'none';
    const style = `
            transform: scale(${scale / 100});
            transform-origin: top left;
            width: ${frameSize}px;
            height: ${frameSize}px;
            background: url('${url}') 0 0;
            animation: ${animationDurationMs}ms steps(1) 0s infinite ${animStyle} running animated-emoji-${frameCount};
        `;
    return style;
}

export { getPrintLocalDate, getPrintFileName, getEmojiFileName, generateEmojiStyle };
