import { youtubeUtils } from "./utils/youtubeUtils.js";
import { yandexProtobuf } from "./yandexProtobuf.js";
import { siteTranslates } from "./config/constants.js"
import requestVideoSubtitles from "./rvs.js";
import debug from "./utils/debug.js";

export async function getSubtitles(siteHostname, videoId, requestLang) {
  const ytSubtitles = siteHostname === "youtube" ? youtubeUtils.getSubtitles() : [];
  const yaSubtitles = await Promise.race([
    new Promise((resolve) => setTimeout(() => {
      console.error("[VOT] Failed get yandex subtitles. Reason: timeout");
      resolve([]);
    }, 5000)),
    new Promise((resolve) => {
      requestVideoSubtitles(
        `${siteTranslates[siteHostname]}${videoId}`,
        requestLang,
        (success, response) => {
          debug.log("[exec callback] Requesting video subtitles");

          if (!success) {
            console.error("[VOT] Failed get yandex subtitles");
            resolve([]);
          }

          const subtitlesResponse = yandexProtobuf.decodeSubtitlesResponse(response);
          console.log("[VOT] Subtitles response: ", subtitlesResponse);

          let subtitles = subtitlesResponse.subtitles ?? [];
          subtitles = subtitles.reduce((result, yaSubtitlesObject) => {
            if ("language" in yaSubtitlesObject) {
              result.push({
                source: "yandex",
                language: yaSubtitlesObject.language,
                url: yaSubtitlesObject.url,
              });
            }
            if ("translatedLanguage" in yaSubtitlesObject) {
              result.push({
                source: "yandex",
                language: yaSubtitlesObject.translatedLanguage,
                translatedFromLanguage: yaSubtitlesObject.language,
                url: yaSubtitlesObject.translatedUrl,
              });
            }
            return result;
          }, []);
          resolve(subtitles);
        }
      );
    })
  ]);
  return [...yaSubtitles, ...ytSubtitles].sort((a, b) => {
    if (a.source !== b.source) { // sort by source
      return a.source === "yandex" ? -1 : 1;
    }
    if (a.source === "yandex") { // sort by translation
      if (a.translatedFromLanguage !== b.translatedFromLanguage) { // sort by translatedFromLanguage
        if (a.translatedFromLanguage === undefined || b.translatedFromLanguage === undefined) { // sort by isTranslated
          return a.translatedFromLanguage === undefined ? 1 : -1;
        }
        return a.translatedFromLanguage === requestLang ? -1 : 1;
      }
      if (a.translatedFromLanguage === undefined) { // sort non translated by language
        return a.language === requestLang ? -1 : 1;
      }
    }
    if (a.source === "youtube" && a.isAutoGenerated !== b.isAutoGenerated) { // sort by isAutoGenerated
      return a.isAutoGenerated ? 1 : -1;
    }
    return 0;
  });
}
