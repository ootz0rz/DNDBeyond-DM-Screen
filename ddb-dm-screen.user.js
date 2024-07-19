// ==UserScript==
// @name            Carm DnD Beyond GM Screen
// @namespace       https://github.com/ootz0rz/DNDBeyond-DM-Screen/
// @version         1.3.3
// @description     GM screen for D&DBeyond campaigns
// @author          ootz0rz
// @match           https://www.dndbeyond.com/campaigns/*
// @exclude         /^https://www.dndbeyond.com/campaigns/.*?/.*?$/
// @updateURL       https://github.com/ootz0rz/DNDBeyond-DM-Screen/raw/master/ddb-dm-screen.user.js
// @require         https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @require         https://media.dndbeyond.com/character-tools/vendors~characterTools.bundle.dec3c041829e401e5940.min.js
// @require         https://www.googletagmanager.com/gtag/js?id=G-XDQBBDCJJV
// @require         https://cdn.jsdelivr.net/npm/tooltipster@4.2.8/dist/js/tooltipster.bundle.min.js
// @grant           GM_setValue
// @grant           GM_getValue
// @license         MIT; https://github.com/ootz0rz/DNDBeyond-DM-Screen/blob/master/LICENSE
// ==/UserScript==

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Script Globals
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const linkUrlTarget = '.ddb-campaigns-character-card-footer-links-item-view';
const linkUrlEdit = '.ddb-campaigns-character-card-footer-links-item-edit';
const campaignElementTarget = '.ddb-campaigns-detail-header-secondary';

const rulesUrls = ["https://character-service.dndbeyond.com/character/v5/rule-data", "https://gamedata-service.dndbeyond.com/vehicles/v3/rule-data"];
const charJSONurlBase = "https://character-service.dndbeyond.com/character/v5/character/";

var stylesheetUrls = [
    "https://raw.githack.com/ootz0rz/DNDBeyond-DM-Screen/master/dm-screen.css"
]

const gameCollectionUrl = {prefix :"https://character-service.dndbeyond.com/character/v5/game-data/", postfix: "/collection"}
const optionalRules = {
    "optionalOrigins": {category:"racial-trait", id:"racialTraitId" },
    "optionalClassFeatures": {category:"class-feature", id:"classFeatureId" },
};

const toolTipsterSettings = {
    theme: ['tooltipster-carm'],

    contentCloning: true,
    contentAsHTML: true,

    animation: 'grow',
    delay: 0,
    animationDuration: 180,

    trigger: 'custom',
    triggerOpen: {
        mouseenter: true,
        touchstart: true,
        tap: true,
    },
    triggerClose: {
        mouseleave: true,
        originClick: true,
        touchleave: true,
        tap: true,
    },

    // interactive: true,
    // delay: 100,
};

const senseToName = {
    'blindsight': 'bs',
    'darkvision': 'dv',
    'tremorsense': 'tms',
    'truesight': 'ts',
    'passive-perception': 'pp',
}

const scriptVarPrefix = "DMScreen-";

const charIDRegex = /\/(\d+).*?$/;
const campaignIDRegex = /\/(\d+)\/*$/;

const FEET_IN_MILES = 5280;
const POUNDS_IN_TON = 2000;
const positiveSign = '+',
    negativeSign = '-';

const autoUpdateDefault = true;
const updateDurationDefault = 60;
const fontSizeDefault = 2;
const displayDeactiveDefault = false;
const displayUnassignedDefault = false;

const fontSizeMap = {
    0: 'font_smallest',
    1: 'font_small',
    2: 'font_normal',
    3: 'font_big',
    4: 'font_biggest',
}

var __isCharPage = null;

const showAbilitiesDefault = true;
const showSavingThrowsDefault = true;
const showSensesDefault = true;
const showClassesDefault = true;
const showResourcesDefault = true;

const currenciesDefault = {gold : 0};
const currenciesTypeDefault = {
    platinum : { name: 'Platinum', conversion: 10 },
    gold : { name: 'Gold', conversion: 1 },
    electrum : { name: 'Electrum', conversion: 0.5 },
    silver : { name: 'Silver', conversion: 0.1 },
    copper : { name: 'Copper', conversion: 0.01 },
};
const currenciesMainDefault = 'gold';

const regexNumberLetterBoundary = new RegExp(/(?<=[\D\.,])(?=[\d\.,])|(?<=[\d\.,])(?=[\D\.,])/g);

const HIDE_CLASS = 'hide';
const NO_DISPLAY_CLASS = 'nodisplay';
const ROW_TOGGLE_CLASS = 'togglehidden';
const ACTIVE_ROW_CLASS = 'active_row';
const ACTIVE_ROW_VAR_NAME_PREFIX = '-active_row-';
const DEFAULT_TOOLTIP_PLACEMENT = 'top';
const DEFAULT_TOOLTIP_TAG = 'span';
const TOOLTIP_PLACEMENT_TOPLEFT = 'top-left';
const ACTIVE_FIRST_ROW_CLASS = 'first_row';
const ACTIVE_SECOND_ROW_CLASS = 'second_row';
const ACTIVE_ROW_TITLE_CLASS = 'activetitle';
const TOOLTIP_INIT_NORMAL = "Initiative";
const TOOLTIP_INIT_ADV = "Initiative, Advantage";
const GP_TOTAL_TOOLTIP = "Approx Total in GP";

const STR_STAT = 'str';
const DEX_STAT = 'dex';
const CON_STAT = 'con';
const INT_STAT = 'int';
const WIS_STAT = 'wis';
const CHA_STAT = 'cha';

/** map from *_STAT name => dndbeyond ID for the stat */
const abilityMap = {};
abilityMap[STR_STAT] = 1;
abilityMap[DEX_STAT] = 2;
abilityMap[CON_STAT] = 3;
abilityMap[INT_STAT] = 4;
abilityMap[WIS_STAT] = 5;
abilityMap[CHA_STAT] = 6;

var $ = window.jQuery;
var rulesData = {},
    charactersData = {},
    campaignID = 0,
    campaignNode = {},
    authHeaders = {},
    editableChars = {};
var mainTable = null;
var colStatsSubTable = null;
var toggleChars = null;

// browser user agents
const IS_CHROME = navigator.userAgent.indexOf('Chrome') > -1;
const IS_IE = navigator.userAgent.indexOf('MSIE') > -1;
const IS_FIREFOX = navigator.userAgent.indexOf('Firefox') > -1;
const IS_SAFARI = navigator.userAgent.indexOf("Safari") > -1;
const IS_OPERA = navigator.userAgent.toLowerCase().indexOf("op") > -1;

// refresh timer
// config
var tockDuration = 1; // in seconds

// state
var page_currentInterval = null;
var refresh_timeSinceLastRefresh = 0;
var refresh_currentTimer = null;
var refresh_autoUpdateNode = null;
var refresh_minTimeNode = null;
var refresh_isTimerActive = false;
var refresh_progressBarContents = null;
var refresh_progressBarCurr = null;
var refresh_progressBarTotal = null;
var refresh_progressBarPct = null;
var refresh_isForceRefresh = false;
var refresh_isUpdateActive = false;

// gse
const DOC_VIS = "visible";
const DOC_HID = "hidden";
const GLAB = {
    SET_ACTIVE: 'set active',
    UPDATE_CHAR: 'update char data',
}
var GV_TIME = () => Math.floor(new Date() / 1000);
const GCAT = {
    REF: 'refresh',
    AUTOREF: 'auto refresh',
    PING: 'ping',
}
const GACT = {
    START: 'start',
    END: 'end',
    CLICK: 'click',
    NOW: 'now',
};

// string format check
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match;
        });
    };
}

// XXX temp for dev
// Test Via `python serve.py`
// stylesheetUrls = ["http://localhost:8000/dm-screen.css"];

console.log("CSS Stylesheets to load: ", stylesheetUrls);
stylesheetUrls.forEach(loadStylesheet);

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        SVGs
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const SVG_CLASS_ICON = `deficon`;
const SVG_CLASS_ICON_WHITE = SVG_CLASS_ICON + ` white`;

function GET_SVG_AS_ICON(icon, color = SVG_CLASS_ICON) {
    return icon.format(` class="{0}"`.format(color));
}

// saves
// -------------------------------------------------------
const SVG_RESISTANCE = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.89941 48" class="ddbc-svg  ddbc-resistance-icon"><path fill="#2C9400" d="M21.18969,15.5h-4.12v7.44h4.12a3.68142,3.68142,0,0,0,2.79-.97,3.75732,3.75732,0,0,0,.94-2.73,3.81933,3.81933,0,0,0-.95-2.74A3.638,3.638,0,0,0,21.18969,15.5Z"></path><path fill="#2C9400" d="M40.4497,8c-11,0-20-6-20-8,0,2-9,8-20,8-4,35,20,40,20,40S44.4497,43,40.4497,8Zm-8.11,29.51h-6.97l-4.77-9.56h-3.53v9.56h-6.51V10.49h10.63c3.2,0,5.71.71,7.51,2.13a7.21618,7.21618,0,0,1,2.71,6.03,8.78153,8.78153,0,0,1-1.14,4.67005,8.14932,8.14932,0,0,1-3.57,3l5.64,10.91Z"></path></svg>`;
const SVG_IMMUNITY = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.89941 48" class="ddbc-svg  ddbc-immunity-icon"><path fill="#2C9400" d="M40.4497,8c-11,0-20-6-20-8,0,2-9,8-20,8-4,35,20,40,20,40S44.4497,43,40.4497,8Zm-16.75,29.42h-6.5V10.4h6.5Z"></path></svg>`;
const SVG_VULNERABILITY = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.89941 48" class="ddbc-svg  ddbc-vulnerability-icon"><path fill="#b00000" d="M40.4497,8c-11,0-20-6-20-8,0,2-9,8-20,8-4,35,20,40,20,40S44.4497,43,40.4497,8Zm-16.63,30.42h-7.12l-9.02-27.02h7.22L20.2597,31.07l5.38-19.67h7.27Z"></path></svg>`;

// advantage/disadvantage
// -------------------------------------------------------
const SVG_ADVANTAGE = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="ddbc-svg ddbc-advantage-svg ddbc-svg--positive"><g><polygon fill="#fff" points="33 6 38 36 10 36 16 6"></polygon><polygon fill="#2C9400" points="24 14 28 26 20 26 24 14"></polygon><path fill="#2C9400" d="M44.39,12.1,23.89.39,3.5,12.29,3.61,35.9l20.5,11.71L44.5,35.71ZM31,36l-2-6H19l-2,6H10L21,8h6L38,36Z"></path></g></svg>`;
const SVG_DISADVANTAGE = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="ddbc-svg ddbc-disadvantage-svg ddbc-svg--negative"><g><polygon fill="#fff" points="35 8 36 39 12 39 14 8"></polygon><path fill="#b00000" d="M27.38,17.75a9.362,9.362,0,0,1,1.44,5.68v1.12a9.4423,9.4423,0,0,1-1.44,5.71A5.21983,5.21983,0,0,1,23,32H21V16h2A5.19361,5.19361,0,0,1,27.38,17.75Z"></path><path fill="#b00000" d="M44.39,12.1,23.89.39,3.5,12.29,3.61,35.9l20.5,11.71L44.5,35.71ZM35.21,24.55a13.50293,13.50293,0,0,1-1.5,6.41,11.09308,11.09308,0,0,1-4.25,4.42A12.00926,12.00926,0,0,1,23.34,37H15V11h8.16a12.35962,12.35962,0,0,1,6.2,1.56,10.97521,10.97521,0,0,1,4.29,4.41,13.31084,13.31084,0,0,1,1.56,6.39Z"></path></g></svg>`;

// aoe types
// -------------------------------------------------------
const SVG_AOE_CONE = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16.73 17.49" class="ddbc-svg ct-action-detail__range-icon ddbc-aoe-type-icon ddbc-aoe-type-icon--cone"><path fill="#242528" d="M14,17.49c-1.85,0-2.69-4.53-2.69-8.74S12.18,0,14,0s2.69,4.53,2.69,8.74S15.88,17.49,14,17.49ZM14,1c-.51,0-1.69,2.63-1.69,7.74s1.19,7.74,1.69,7.74,1.69-2.63,1.69-7.74S14.54,1,14,1Z"></path><path fill="#242528" d="M14,17.49a.5.5,0,0,1-.26-.07L.24,9.17a.5.5,0,0,1,0-.85L13.77.07a.5.5,0,1,1,.52.85L1.46,8.74l12.83,7.82a.5.5,0,0,1-.26.93Z"></path></svg>`;
const SVG_AOE_CUBE = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16.89 17.57" class="ddbc-svg ct-action-detail__range-icon ddbc-aoe-type-icon ddbc-aoe-type-icon--cube"><path fill="#242528" d="M13.43,17.57H.5a.5.5,0,0,1-.5-.5V4.14a.5.5,0,0,1,.5-.5H13.43a.5.5,0,0,1,.5.5V17.07A.5.5,0,0,1,13.43,17.57ZM1,16.57H12.93V4.64H1Z"></path><path fill="#242528" d="M13.43,17.57a.5.5,0,0,1-.4-.81l2.86-3.71V1.91L13.82,4.46A.5.5,0,1,1,13,3.83L16,.18a.5.5,0,0,1,.89.32V13.23a.5.5,0,0,1-.1.31l-3,3.85A.5.5,0,0,1,13.43,17.57Z"></path><path fill="#242528" d="M.5,4.64A.5.5,0,0,1,.13,3.8L3.55.16A.5.5,0,0,1,3.91,0H16.39a.5.5,0,0,1,0,1H4.13L.87,4.48A.5.5,0,0,1,.5,4.64Z"></path></svg>`;
const SVG_AOE_CYLINDER = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.49 18.31" class="ddbc-svg ct-action-detail__range-icon ddbc-aoe-type-icon ddbc-aoe-type-icon--cylinder"><path fill="#242528" d="M8.74,5.38C4.53,5.38,0,4.54,0,2.69S4.53,0,8.74,0s8.74.84,8.74,2.69S13,5.38,8.74,5.38ZM8.74,1C3.63,1,1,2.19,1,2.69S3.63,4.38,8.74,4.38s7.74-1.19,7.74-1.69S13.85,1,8.74,1Z"></path><path fill="#242528" d="M8.74,18.31C4.53,18.31,0,17.47,0,15.62V2.69a.5.5,0,0,1,1,0V15.62c0,.51,2.63,1.69,7.74,1.69s7.74-1.19,7.74-1.69V2.69a.5.5,0,0,1,1,0V15.62C17.49,17.47,13,18.31,8.74,18.31Z"></path></svg>`;
const SVG_AOE_LINE = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.49 7.1" class="ddbc-svg ct-action-detail__range-icon ddbc-aoe-type-icon ddbc-aoe-type-icon--line"><path fill="#242528" d="M14,5.44H.5a.5.5,0,0,1-.5-.5V2a.5.5,0,0,1,.5-.5H14a.5.5,0,0,1,0,1H1v2H14a.5.5,0,0,1,0,1Z"></path><path fill="#242528" d="M14,7.1a.49.49,0,0,1-.18,0,.5.5,0,0,1-.32-.46V4.94a.5.5,0,0,1,1,0v.4l1.76-1.87L14.53,1.71v.17a.5.5,0,0,1-1,0V.5a.5.5,0,0,1,.85-.35l3,3a.5.5,0,0,1,0,.7l-3,3.15A.5.5,0,0,1,14,7.1Z"></path></svg>`;
const SVG_AOE_SPHERE = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18.06" class="ddbc-svg ct-action-detail__range-icon ddbc-aoe-type-icon ddbc-aoe-type-icon--sphere"><path fill="#242528" d="M9,1A8,8,0,1,1,1,9,8,8,0,0,1,9,1M9,0a9,9,0,1,0,9,9A9,9,0,0,0,9,0Z"></path><path fill="#242528" d="M9,18.06a.5.5,0,0,1,0-1c2,0,3.65-3.68,3.65-8S11,1,9,1A.5.5,0,0,1,9,0c2.61,0,4.65,4,4.65,9S11.61,18.06,9,18.06Z"></path><path fill="#242528" d="M9.48,11.44A18.11,18.11,0,0,1,.28,8.84.5.5,0,0,1,.78,8c9,5.25,16.37.49,16.44.44a.5.5,0,0,1,.56.83A16.25,16.25,0,0,1,9.48,11.44Z"></path></svg>`;
const SVG_AOE_SQUARE = `<svg{0} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13.75 13.33" class="ddbc-svg ct-action-detail__range-icon ddbc-aoe-type-icon ddbc-aoe-type-icon--square"><rect fill="#fff" stroke="#242528" stroke-miterlimit="10" class="cls-1" x="0.71" y="0.29" width="12.33" height="12.75" transform="translate(0.21 13.54) rotate(-90)"></rect></svg>`;
const SVG_AOE_SQFT = ``;

const AOE_ID_TO_SVG = {
    1: SVG_AOE_CONE,
    2: SVG_AOE_CUBE,
    3: SVG_AOE_CYLINDER,
    4: SVG_AOE_LINE,
    5: SVG_AOE_SPHERE,
    9: SVG_AOE_SQUARE,
    13: SVG_AOE_SQFT,
};

/**
 * return SVG string or null
 */
function GET_AOE_ICON_FROM_ID(id, color = SVG_CLASS_ICON_WHITE) {
    if (id in AOE_ID_TO_SVG) {
        return GET_SVG_AS_ICON(AOE_ID_TO_SVG[id], color);
    }

    return null;
}

// damage types
// -------------------------------------------------------
const SVG_DMG_ACID = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10.91 17.92" class="ddbc-svg ddbc-damage-type-icon__img ddbc-damage-type-icon__img--acid"><path fill="#242528" d="M6.84,10.62q.65,0,.65-.8a.69.69,0,0,0-.16-.5.64.64,0,0,0-.48-.16q-.67,0-.67.72T6.84,10.62Z"></path><path fill="#242528" d="M4.53,10.62q.66,0,.66-.8t-.64-.66A.66.66,0,0,0,4,9.33a.76.76,0,0,0-.17.54Q3.87,10.62,4.53,10.62Z"></path><path fill="#242528" d="M5.49.65V0a3.3,3.3,0,0,1,0,.34,3.3,3.3,0,0,1,0-.34V.65C4.8,3.87,0,8.34,0,12.08c0,4,2,5.8,5.42,5.83h.07c3.47,0,5.42-1.86,5.42-5.83C10.91,8.34,6.11,3.87,5.49.65ZM3.69,6.91a2.93,2.93,0,0,1,2-.65,2.93,2.93,0,0,1,2,.65A2.12,2.12,0,0,1,8.39,8.6a3.45,3.45,0,0,1-.5,1.75,1,1,0,0,0-.08.28l-.1.65-1.09.52-.16.4a2.54,2.54,0,0,1-.8.1,3.37,3.37,0,0,1-.45,0,2.09,2.09,0,0,1-.35-.07l-.16-.4-1.1-.52-.1-.65a2.67,2.67,0,0,0-.34-.73,2.65,2.65,0,0,1-.24-1.3A2.12,2.12,0,0,1,3.69,6.91ZM8.08,16q-.3.36-.49.36t-.45-.61l-.07-.19a10,10,0,0,0-1.63-1.13,8.87,8.87,0,0,0-1.65,1.19q-.1.73-.44.73t-.49-.41q-.66,0-.66-.36a.4.4,0,0,1,.25-.39,4.29,4.29,0,0,1,1-.24,11.71,11.71,0,0,1,1.4-.87,7,7,0,0,0-1.78-.67,1.57,1.57,0,0,1-.3.21.55.55,0,0,1-.25.07.4.4,0,0,1-.26-.07.25.25,0,0,1-.09-.21,1.24,1.24,0,0,1,.29-.5,1.86,1.86,0,0,1-.06-.4.45.45,0,0,1,.08-.29.28.28,0,0,1,.23-.09.7.7,0,0,1,.39.19,4.73,4.73,0,0,1,.58.59,15.64,15.64,0,0,1,1.79.8q.42-.23,1.48-.68l.27-.12a6.63,6.63,0,0,1,.62-.57.75.75,0,0,1,.36-.19.24.24,0,0,1,.2.08.42.42,0,0,1,.06.26,2.75,2.75,0,0,1,0,.42,1,1,0,0,1,.28.52.29.29,0,0,1-.08.22.33.33,0,0,1-.23.07.6.6,0,0,1-.24-.08l-.4-.24A7.2,7.2,0,0,0,6,14.1l.21.12q.39.22,1,.59l.32.19q1.18.14,1.18.6Q8.72,15.9,8.08,16Z"></path><path fill="#242528" d="M5.51,11.67a.36.36,0,0,0,.19-.06.36.36,0,0,0,.19.06q.29,0,.29-.26A.6.6,0,0,0,6,11.09a3.06,3.06,0,0,1-.29-.41,3.38,3.38,0,0,1-.29.41.6.6,0,0,0-.19.33.23.23,0,0,0,.07.19A.32.32,0,0,0,5.51,11.67Z"></path></svg>`;
const SVG_DMG_BLUDGEON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20.29 19.76" class="ddbc-svg ddbc-damage-type-icon__img ddbc-damage-type-icon__img--bludgeoning"><polygon fill="#242528" points="5.88 14.95 0.45 15.85 4.14 12.74 0.15 9.36 4.26 9.36 0 0 5.52 4.58 4.61 1.05 6.75 2.8 8.19 0.43 9.93 3.57 11.67 0.68 10.68 13.56 5.88 14.95"></polygon><polygon fill="#242528" points="5.17 19.26 8.62 13.3 8.09 12.99 8.71 11.92 7.2 11.05 6.71 11.9 4.16 10.44 7.91 3.95 10.45 5.41 9.97 6.25 11.46 7.11 13.53 4.75 16.22 7.44 14.9 9.09 16.58 10.06 17.06 9.23 19.6 10.7 15.86 17.19 13.31 15.72 13.81 14.86 12.13 13.89 11.51 14.96 10.99 14.66 8.35 19.26 5.17 19.26"></polygon><path fill="#fff" d="M8.09,4.63l1.68,1L6.52,11.22l-1.68-1L8.09,4.63m5.46.85,2,2L14.5,8.79,11.95,7.32l1.61-1.84M9.78,6.71l6.5,3.75L14,14.4,7.5,10.64,9.78,6.71m7.47,3.2,1.68,1L15.67,16.5l-1.68-1,3.25-5.63h0M9.12,12.22h0m0,0,2.55,1.47-.34.59L8.78,12.81l.34-.59M9,13.6l1.51.87-2.47,4.3H6L9,13.6H9M7.73,3.26l-.5.87L4,9.75l-.5.87.87.5,1.68,1,.87.5.5-.86L8,12.1l-.12.21-.5.87.53.3L5.17,18.26l-.87,1.5H8.63l.29-.5,2.25-3.92.52.3.5-.87.12-.21.81.47-.5.86.87.5,1.68,1,.87.5.5-.87,3.25-5.63.5-.87-.87-.5L17.74,9l-.87-.5-.48.83-.74-.43.68-.84.56-.7-.63-.63-2-2L13.5,4l-.7.81L11.36,6.47l-.7-.41.48-.83-.87-.5-1.68-1-.87-.5Z"></path></svg>`;
const SVG_DMG_COLD = ``;
const SVG_DMG_FIRE = ``;
const SVG_DMG_FORCE = ``;
const SVG_DMG_LIGHTNING = ``;
const SVG_DMG_NECROTIC = ``;
const SVG_DMG_PIERCING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21.17 18.95" class="ddbc-svg ddbc-damage-type-icon__img ddbc-damage-type-icon__img--piercing"><polygon fill="#242528" points="10.63 9.48 13.07 3.78 7.76 6.5 9.98 1.47 6.26 5.16 6.26 0 1.73 9.48 6.26 18.95 6.26 13.8 9.98 17.48 7.76 12.45 13.07 15.17 10.63 9.48"></polygon><path fill="#242528" d="M13.31,12.64c-2.59,0-8.5-.75-11.1-2.55l-.89-.62.89-.62c2.6-1.8,8.51-2.55,11.1-2.55h7.11v6.33Z"></path><path fill="#fff" d="M19.67,7.06v4.83H13.31c-2.55,0-8.29-.76-10.67-2.41C5,7.82,10.75,7.06,13.31,7.06h6.36m1.5-1.5H13.31c-2.67,0-8.79.79-11.53,2.68L0,9.48l1.78,1.23c2.73,1.89,8.86,2.68,11.53,2.68h7.86V5.56Z"></path></svg>`;
const SVG_DMG_POISON = ``;
const SVG_DMG_PSYCHIC = ``;
const SVG_DMG_RADIANT = ``;
const SVG_DMG_SLASHING = ``;
const SVG_DMG_THUNDER = ``;

const DMG_ID_TO_SVG = {

};

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        HTML Structures
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

var mainTableHTML = `
<table class="table primary">
    <thead>
        <tr>
            <th class="col_name" rowspan="2">
                <span class="name">Name</span><br />
                <span class="exhaust"><span>E</span>xhaust</span><br />
                <span class="spellsavedc">Class <span class="lvl">lvl</span>: <span class="dc">DC</span></span>
            </th>
            <th class="col_hp" rowspan="2">
                <span class="overheal">He</span><span class="good">al</span><span class="normal">th</span><span class="hurt"> P</span><span class="bad">ts</span>
                <hr />
                <span class="fail">D</span>eath <span class="save">S</span>aves
            </th>
            <th class="col_ac" rowspan="2">
                <span role="tooltip" title="Armor Class">AC</span>
                <hr />
                <div class="init" role="tooltip" title="Initiative">Init</div>
            </th>
            <th class="col_speed" rowspan="2">
                <span>Sp</span>eed<hr />
                Sens<span>es</span>
            </th>
            <th colspan="7" class="col_stat stat_types b_left b_right">
                <div class="statscore"><span class='letter'>A</span>bility scores</div>
                <div class="bonus"><span class='letter'>B</span>onus</div>
                <div class="save"><span class='letter'>S</span>ave/<span class="prof">Proficient</span></div>
            </th>
            <th class="col_passives" rowspan="2">
                <div role="tooltip" title="Passive Perception"><span>per</span>cept</div>
                <div role="tooltip" title="Passive Investigation"><span>inv</span>est</div>
                <div role="tooltip" title="Passive Insight"><span>ins</span>ight</div>
            </th>
            <th class="col_money" rowspan="2"><span class="pp">$</span><span class="ep">$</span><span class="gp">$</span><span class="sp">$</span><span class="cp">$</span></th>
            <th class="col_skills" rowspan="2"><span class="prof high">Skill Proficiences <span class="value">(+bonus)</span></span></th>
            <th class="col_languages" rowspan="2">Languages</th>
        </tr>
    </thead>
    <tbody id="gm_table_body">
    </tbody>
    <tfoot>
        <tr id="totals">
            <td class="col_name" colspan="12">Party Total Money:</td>
            <td class="col_money" colspan="3">
                <span class="total" role="tooltip" title="Approx Total in GP"></span>
                <span class="expanded">
                    <hr />
                    <span class="ppc"><span class="pp"></span> pp </span>
                    <span class="epc"><span class="ep"></span> ep </span>
                    <span class="gpc"><span class="gp"></span> gp </span>
                    <span class="spc"><span class="sp"></span> sp </span>
                    <span class="cpc"><span class="cp"></span> cp </span>
                </span>
            </td>
        </tr>
        <tr>
            <td id="foot1" colspan="15" class='gs-controls'>
                <span class="gs-form-field gs-form-field-number gs-row-container set">
                    <label class="" for="gs-font-size">Font:</label>
                    <select name="gs-font-size" id="gs-font-size" class='dropdown selectpicker font_size'>
                        <option disabled selected>Font Size</option>
                        <option value='0'>smallest</option>
                        <option value='1'>small</option>
                        <option value='2'>normal</option>
                        <option value='3'>big</option>
                        <option value='4'>biggest</option>
                    </select>
                </span>
                <span class="gs-form-field gs-row-container set">
                    <input class="btn-check" type="checkbox" name="gs-display-deactive" id="gs-display-deactive" value="false">
                    <label class="btn btn-outline-warning" for="gs-display-deactive">Display Deactive</label>
                </span>
                <span class="gs-form-field gs-row-container set">
                    <input class="btn-check" type="checkbox" name="gs-display-unassigned" id="gs-display-unassigned" value="false">
                    <label class="btn btn-outline-warning" for="gs-display-unassigned">Display Un-assigned</label>
                </span>
                <span class="autoupdateset">
                    <span class="set">
                        <span class="">
                            <label for="gs-auto-duration">seconds:</label>
                            <input class="form-control auto_duration" type="number" name="gs-auto-duration" id="gs-auto-duration" value="60" placeholder="secs">
                        </span>
                    </span>
                    <span class="gs-form-field gs-row-container set">
                        <a id="time_short" role='button' class='btn btn-outline-info' href="#">30s</a>
                        <a id="time_long" role='button' class='btn btn-outline-info' href="#">90s</a>
                        <a id="time_verylong" role='button' class='btn btn-outline-info' href="#">150s</a>
                        <input class="btn-check" type="checkbox" name="gs-auto-update" id="gs-auto-update" value="false">
                        <label class="btn btn-outline-warning" for="gs-auto-update">Auto Update</label>
                        <a id="force_refresh" role='button' class='btn btn-outline-info' href="#">Force Refresh</a>
                    </span>
                </span>
            </td>
        </tr>
        <tr>
            <td id="foot2" colspan="15" class="gs-controls gs-bottom">
                <span class='update'>
                    <a role='button' class='btn btn-outline-info' target="_blank" href="https://github.com/ootz0rz/DNDBeyond-DM-Screen/raw/master/ddb-dm-screen.user.js">check for script update</a>
                    <a id='dark_mode_toggle' role='button' data-bs-toggle='button' class='btn btn-outline-info' href="#">site dark mode</a>
                    <a id='scroll_toggle' role='button' data-bs-toggle='button' class='btn btn-outline-info' href="#">hide scroll</a>
                    <a id='log_toggle' role='button' data-bs-toggle='button' class='btn btn-outline-info' href="#">hide log</a>
                    <a id='header_toggle' role='button' data-bs-toggle='button' class='btn btn-outline-info' href="#">hide header</a>
                    <a id='banner_toggle' role='button' data-bs-toggle='button' class='btn btn-outline-info' href="#">hide banners</a>
                </span>
                <span class='pbarwrap'>
                    <span class='progress-wrapper set'>
                        <span class="text_progress">
                            <span class="curr"></span><span class="total">0</span>s<span class="pct"></span>
                        </span>
                        <span class="progress-bar"><span class="progress-bar-fill" style="width: 0%; transform: scaleX(0);"></span></span>
                    </span>
                </span>
            </td>
        </tr>
        <tr>
            <td id="foot3" colspan="15" class="gs-controls">
                <label>Toggle Characters: </label>
                <span id='togglechars'></span>
            </td>
        </tr>
    </tfoot>
</table>
`;

var tableRowHTML = `
        <tr>
            <td class="col_name">
                <span class="name" role="tooltip" title="Toggle Detail View"></span><span class="inspiration hide" role="tooltip" title="Inspiration">🎲</span>
                <span class="links"><span role="tooltip" title="Edit"><a href="#" class="edit hide"></a></span><span role="tooltip" title="View"><a href="#" class="view hide"></a></span></span><br/>
                <div class="exhaust"><span></span>- - - - - -</div>
                <div class="spellsavedc"><span></span></div>
                <div class="classes"></div>
                <div class="profbonus"><hr /><span class="pb" role="tooltip" title="Proficiency Bonus">PB: <span class="pbval">+2</span></span></div>
                <div class="conditions">
                    <hr />
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/blinded.svg" class="deficon_large cond_blinded"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/charmed.svg" class="deficon_large cond_charmed"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/deafened.svg" class="deficon_large cond_deafened"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/frightened.svg" class="deficon_large cond_frightened"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/grappled.svg" class="deficon_large cond_grappled"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/incapacitated.svg" class="deficon_large cond_incapacitated"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/invisible.svg" class="deficon_large cond_invisible"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/paralyzed.svg" class="deficon_large cond_paralyzed"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/petrified.svg" class="deficon_large cond_petrified"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/poisoned.svg" class="deficon_large cond_poisoned"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/prone.svg" class="deficon_large cond_prone"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/restrained.svg" class="deficon_large cond_restrained"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/stunned.svg" class="deficon_large cond_stunned"></span> 
                    <span class="cond hide"><img src="https://www.dndbeyond.com/content/1-0-1862-0/skins/waterdeep/images/icons/conditions/white/unconscious.svg" class="deficon_large cond_unconscious"></span> 
                </div>
            </td>
            <td class="col_hp">
                <span class="hurt"></span>
            </td>
            <td class="col_ac">
                <span class="acval" role="tooltip" title="Armor Class"></span>
                <hr />
                <span class="initval" role="tooltip" title="Initiative"></span>
            </td>
            <td class="col_speed"></td>
            <td class="col_stat col_titles b_left">
                <div class="stat_title">&nbsp;</div>
                <span role="tooltip" title="Ability Score">A</span><br/>
                <span role="tooltip" title="Bonus">B</span><br/>
                <span role="tooltip" title="Save">S</span></td>
            <td class="col_stat col_str"></td>
            <td class="col_stat col_dex"></td>
            <td class="col_stat col_con"></td>
            <td class="col_stat col_int"></td>
            <td class="col_stat col_wis"></td>
            <td class="col_stat col_cha b_right"></td>
            <td class="col_passives">
                per: <span></span><br />
                inv: <span></span><br />
                ins: <span></span>
            </td>
            <td class="col_money">
                <span class="total" role="tooltip" title="Approx Total in GP"></span>
                <span class="expanded">
                    <hr />
                    <span class="ppc"><span class="pp"></span> pp</span>
                    <span class="epc"><span class="ep"></span> ep </span>
                    <span class="gpc"><span class="gp"></span> gp </span>
                    <span class="spc"><span class="sp"></span> sp </span>
                    <span class="cpc"><span class="cp"></span> cp </span>
                </span>
            </td>
            <td class="col_skills"></td>
            <td class="col_languages">
                <div class="langset">
                    <span class="langs"></span>
                </div>
                <hr class="langshr" />
                <div class="resset">
                    <span class="resists"></span>
                </div>
                <div class="immset">
                    <span class="immunities"></span>
                </div>
                <div class="vulnset">
                    <span class="vulnerabilities"></span>
                </div>
                <div class="saveset">
                    <span class="savemods"></span>
                </div>
            </td>
        </tr>
`;

var tableSecondRowHTML = `
        <tr id="_details" class="active_row second_row">
            <td class='col_details' colspan="14">
                <table class="table detailstable font_normal secondary">
                    <tbody>
                        <tr>
                            <td class='col_skills' colspan="2"></td>
                        </tr>
                        <tr>
                            <td class="col_jump" colspan="2">
                                <span class="activetitle">Jump:</span>
                                <span class="jumpstats">
                                    <span class="panelblock stand" title="Jump distances in <code>ft</code> from a <b><u><code>standing</code></u></b> start">
                                        <span class="title">Standing</span>
                                        <span class="body">
                                            <span class="group long">
                                                <span class="title">long</span>
                                                <span class="body"><span class="value"><span class="num"></span><span class="units hide">ft</span></span></span>
                                            </span>
                                            <span class="group high">
                                                <span class="title">high</span>
                                                <span class="body"><span class="value"><span class="num"></span><span class="units hide">ft</span></span></span>
                                            </span>
                                            <span class="group grab">
                                                <span class="title">reach</span>
                                                <span class="body"><span class="value"><span class="num"></span><span class="units hide">ft</span></span></span>
                                            </span>
                                        </span>
                                    </span>
                                    <span class="panelblock run" title="Jump distances in <code>ft</code> from a <b><u><code>running</code></u></b> start">
                                        <span class="title">Running <span class="value"><span class="num">10</span><span class="units">ft</span></span></span>
                                        <span class="body">
                                            <span class="group long">
                                                <span class="title">long</span>
                                                <span class="body"><span class="value"><span class="num"></span><span class="units hide">ft</span></span></span>
                                            </span>
                                            <span class="group high">
                                                <span class="title">high</span>
                                                <span class="body"><span class="value"><span class="num"></span><span class="units hide">ft</span></span></span>
                                            </span>
                                            <span class="group grab">
                                                <span class="title">reach</span>
                                                <span class="body"><span class="value"><span class="num"></span><span class="units hide">ft</span></span></span>
                                            </span>
                                        </span>
                                    </span>
                                    <span class="panelblock obstacle" title="Maximum height of an obstacle in <code>ft</code> that can be cleared without a <code>DC10 STR/Athletics</code> check">
                                        <span class="title">Max Obstacle</span>
                                        <span class="body"><span class="value"><span class="num"></span><span class="units hide">ft</span></span></span>
                                    </span>
                                    <span class="panelblock reach">
                                        <span class="title">Reach</span>
                                        <span class="body"><span class="value"><span class="num">½</span> char height</span></span>
                                    </span>
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </td>
        </tr>
`;

var a = $("<script>", { type: 'text/javascript', src: 'https://www.googletagmanager.com/gtag/js?id=G-XDQBBDCJJV' });
a[0].setAttribute("async", "");
$("body").append(a);

var a2 = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-XDQBBDCJJV');`;
var script = document.createElement('script');
script.innerHTML = a2;
document.body.appendChild(script);

setTimeout(`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-N24JLJH');console.log('gse ready');`, 10);
var a4 = $(`<noscript></noscript>`).append($(`<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-N24JLJH" height="0" width="0" style="display:none;visibility:hidden"></iframe>`));
document.body.prepend(a4[0]);

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Custom additonal modules to be loaded with D&DBeyond's module loader
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

var initalModules = {
    2080: function (module, __webpack_exports__, __webpack_require__) {
        "use strict";
        __webpack_require__.r(__webpack_exports__);
        console.log("Module 2080: start");
        // Unused modules:
        // var react = __webpack_require__(0);
        // var react_default = __webpack_require__.n(react);
        // var react_dom = __webpack_require__(84);
        // var react_dom_default = __webpack_require__.n(react_dom);
        // var es = __webpack_require__(10);
        var dist = __webpack_require__(710);
        var dist_default = __webpack_require__.n(dist);
        var Core = __webpack_require__(5);
        var character_rules_engine_lib_es = __webpack_require__(1);
        var character_rules_engine_web_adapter_es = __webpack_require__(136);

        var crk = "js";
        var ktl = "U";
        var cmov = "ab";

        var key = "";

        for (key in character_rules_engine_lib_es) {
            if (typeof character_rules_engine_lib_es[key].getAbilities === 'function') {
                crk = key;
                console.log("crk found: " + key);
            }
            if (typeof character_rules_engine_lib_es[key].getSenseTypeModifierKey === 'function') {
                ktl = key;
                console.log("ktl found: " + key);
            }
        }

        for (key in Core) {
            if (typeof Core[key].WALK !== 'undefined' && typeof Core[key].SWIM !== 'undefined' && typeof Core[key].CLIMB !== 'undefined' && typeof Core[key].FLY !== 'undefined' && typeof Core[key].BURROW !== 'undefined') {
                cmov = key;
                console.log("cmov found: " + key);
            }
        }

        var charf1 = character_rules_engine_lib_es[crk];
        var charf2 = character_rules_engine_lib_es[ktl];
        var coref1 = character_rules_engine_lib_es[cmov];

        function getAuthHeaders() {
            return dist_default.a.makeGetAuthorizationHeaders({});

        }

        function getCharData(state) {
            /*
                All parts of the following return are from http://media.dndbeyond.com/character-tools/characterTools.bundle.71970e5a4989d91edc1e.min.js, they are found in functions that have: '_mapStateToProps(state)' in the name, like function CharacterManagePane_mapStateToProps(state)
                Any return that uses the function character_rules_engine_lib_es or character_rules_engine_web_adapter_es can be added to this for more return values as this list is not comprehensive.
                Anything with selectors_appEnv is unnessisary,as it just returns values in state.appEnv.
            */
            console.log("Module 2080: Processing State Info Into Data");

            var ruleData = charf1.getRuleData(state);

            function getSenseData(senses) { // finds returns the label
                return Object.keys(senses).map(function (index) {
                    let indexInt = parseInt(index);
                    return {
                        id: indexInt,
                        key: charf2.getSenseTypeModifierKey(indexInt),
                        name: charf2.getSenseTypeLabel(indexInt),
                        distance: senses[indexInt]
                    }
                })
            }

            function getSpeedData(speeds) { // finds returns the label
                let halfSpeed = roundDown(divide(speeds[Core[cmov].WALK], 2));
                return Object.keys(speeds).map(function (index) {
                    let distance = speeds[index];
                    if (Core[cmov].SWIM === index || Core[cmov].CLIMB === index) {
                        // swim speed is essentiall half walking speed rounded down if character doesn't have a set swim speed:
                        // source https://www.dndbeyond.com/sources/basic-rules/adventuring#ClimbingSwimmingandCrawling
                        distance = speeds[index] <= 0 ? halfSpeed : speeds[index];
                    }
                    return {
                        id: charf2.getMovementTypeBySpeedMovementKey(index),
                        key: index,
                        name: charf2.getSpeedMovementKeyLabel(index, ruleData),
                        distance: distance
                    }
                });
            }

            return {
                name: charf1.getName(state),
                avatarUrl: charf1.getAvatarUrl(state),
                spellCasterInfo: charf1.getSpellCasterInfo(state),
                armorClass: charf1.getAcTotal(state),
                initiative: charf1.getProcessedInitiative(state),
                hasInitiativeAdvantage: charf1.getHasInitiativeAdvantage(state),
                resistances: charf1.getActiveGroupedResistances(state),
                immunities: charf1.getActiveGroupedImmunities(state),
                vulnerabilities: charf1.getActiveGroupedVulnerabilities(state),
                conditions: charf1.getActiveConditions(state),
                choiceInfo: charf1.getChoiceInfo(state),
                classes: charf1.getClasses(state),
                feats: charf1.getBaseFeats(state),
                race: charf1.getRace(state),
                currentXp: charf1.getCurrentXp(state),
                preferences: charf1.getCharacterPreferences(state),
                totalClassLevel: charf1.getTotalClassLevel(state),
                spellCasterInfo: charf1.getSpellCasterInfo(state),
                startingClass: charf1.getStartingClass(state),
                background: charf1.getBackgroundInfo(state),
                notes: charf1.getCharacterNotes(state),
                totalWeight: charf1.getTotalWeight(state),
                carryCapacity: charf1.getCarryCapacity(state),
                pushDragLiftWeight: charf1.getPushDragLiftWeight(state),
                encumberedWeight: charf1.getEncumberedWeight(state),
                heavilyEncumberedWeight: charf1.getHeavilyEncumberedWeight(state),
                preferences: charf1.getCharacterPreferences(state),
                currencies: charf1.getCurrencies(state),
                attunedSlots: charf1.getAttunedSlots(state),
                attunableArmor: charf1.getAttunableArmor(state),
                attunableGear: charf1.getAttunableGear(state),
                attunableWeapons: charf1.getAttunableWeapons(state),
                startingClass: charf1.getStartingClass(state),
                background: charf1.getBackgroundInfo(state),
                equipped: {
                    armorItems: charf1.getEquippedArmorItems(state),
                    weaponItems: charf1.getEquippedWeaponItems(state),
                    gearItems: charf1.getEquippedGearItems(state)
                },
                unequipped: {
                    armorItems: charf1.getUnequippedArmorItems(state),
                    weaponItems: charf1.getUnequippedWeaponItems(state),
                    gearItems: charf1.getUnequippedGearItems(state)
                },
                hitPointInfo: charf1.getHitPointInfo(state),
                fails: charf1.getDeathSavesFailCount(state),
                successes: charf1.getDeathSavesSuccessCount(state),
                abilities: charf1.getAbilities(state), // not sure what the difference is between this and abilityLookup, seems to be one is a object, the other an array...
                abilityLookup: charf1.getAbilityLookup(state),
                proficiencyBonus: charf1.getProficiencyBonus(state),
                speeds: getSpeedData(charf1.getCurrentWeightSpeed(state)),
                preferences: charf1.getCharacterPreferences(state),
                inspiration: charf1.getInspiration(state),
                passivePerception: charf1.getPassivePerception(state),
                passiveInvestigation: charf1.getPassiveInvestigation(state),
                passiveInsight: charf1.getPassiveInsight(state),
                senses: getSenseData(charf1.getSenseInfo(state)), //has to be further processed
                skills: charf1.getSkills(state),
                customSkills: charf1.getCustomSkills(state),
                savingThrowDiceAdjustments: charf1.getSavingThrowDiceAdjustments(state),
                situationalBonusSavingThrowsLookup: charf1.getSituationalBonusSavingThrowsLookup(state),
                deathSaveInfo: charf1.getDeathSaveInfo(state),
                proficiencyGroups: charf1.getProficiencyGroups(state),
                background: charf1.getBackgroundInfo(state),
                alignment: charf1.getAlignment(state),
                height: charf1.getHeight(state),
                weight: charf1.getWeight(state),
                size: charf1.getSize(state),
                faith: charf1.getFaith(state),
                skin: charf1.getSkin(state),
                eyes: charf1.getEyes(state),
                hair: charf1.getHair(state),
                age: charf1.getAge(state),
                gender: charf1.getGender(state),
                traits: charf1.getCharacterTraits(state),
                notes: charf1.getCharacterNotes(state),
                levelSpells: charf1.getLevelSpells(state),
                spellCasterInfo: charf1.getSpellCasterInfo(state),
                ruleData: charf1.getRuleData(state),
                xpInfo: charf1.getExperienceInfo(state),
                spellSlots: charf1.getSpellSlots(state),
                pactMagicSlots: charf1.getPactMagicSlots(state),
                attunedSlots: charf1.getAttunedSlots(state),
                hasMaxAttunedItems: charf1.hasMaxAttunedItems(state),
                weaponSpellDamageGroups: charf1.getWeaponSpellDamageGroups(state),
                inventory: charf1.getInventory(state),
                creatures: charf1.getCreatures(state),
                customItems: charf1.getCustomItems(state),
                weight: charf1.getTotalWeight(state),
                weightSpeedType: charf1.getCurrentWeightType(state),
                notes: charf1.getCharacterNotes(state),
                currencies: charf1.getCurrencies(state),
                activatables: charf1.getActivatables(state),
                attacks: charf1.getAttacks(state),
                weaponSpellDamageGroups: charf1.getWeaponSpellDamageGroups(state),
                attacksPerActionInfo: charf1.getAttacksPerActionInfo(state),
                ritualSpells: charf1.getRitualSpells(state),
                spellCasterInfo: charf1.getSpellCasterInfo(state),
                originRefRaceData: charf1.getDataOriginRefRaceData(state),
                hasSpells: charf1.hasSpells(state),
                optionalOrigins: charf1.getOptionalOrigins(state),
            }
        }
        window.moduleExport = {
            getCharData: getCharData,
            getAuthHeaders: getAuthHeaders,
        }
        console.log("Module 2080: end");
    }
};


//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Main Function
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

(function () {
    campaignID = window.location.pathname.match(charIDRegex);
    findTargets();

    console.log("Targets: ", charactersData);
    if (Object.keys(charactersData).length == 0) {
        console.log("No characters found to display!");
        return;
    }

    insertElements();
    insertCampaignElements();

    applyTooltips(parentNode = mainTable);

    updateAllCharData();

    initRefreshTimer();
    initPageTimer();
})();

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Functions
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function findTargets() {
    if (isCharacterPage()) {
        findCharacterTargets();
    } else {
        findCampaignTargets();
    }
}

function findCharacterTargets() {
    console.log("Locating Characters from Character Window");

    var charID = getCharacterPageCharID();
    if (charID.length == 0) {
        return;
    }

    let editurl = window.location.href + "/builder";
    editableChars[charID] = {
        // https://www.dndbeyond.com/characters/.../builder/
        editurl: editurl,
    }

    let node = $("div[name='character-app']");
    populateCharData(charID, node, '', '', 'active');
}


function findCampaignTargets() {
    console.log("Locating Characters from Campaign Window");
    $(linkUrlEdit).each((index, value) => {
        var url = value.href;
        var charID = getCharIDFromURL(url);
        if (charID != 0) {
            editableChars[charID] = {
                editurl: url,
            };
        }
    });

    $(linkUrlTarget).each(function (index, value) {
        var url = value.href;
        console.log("Processing view url: " + url);
        var charID = getCharIDFromURL(url);
        if (charID != 0) {
            let node = $(value).parents('li');
            let type = 'unknown';
            let typeNode = $(value).parents('.ddb-campaigns-detail-body-listing');
            if (typeNode.hasClass('ddb-campaigns-detail-body-listing-active')) {
                let unassignedNode = $(value).parents('.ddb-campaigns-detail-body-listing-unassigned-active');
                if (unassignedNode.length > 0) {
                    type = 'unassigned';
                } else {
                    type = 'active';
                }
            } else if (typeNode.hasClass('ddb-campaigns-detail-body-listing-inactive')) {
                type = 'deactivated';
            }
            var editurl = '';
            if (charID in editableChars) {
                editurl = editableChars[charID].editurl;
                console.log("Editable character: ", charID, editurl);
            }

            populateCharData(charID, node, url, editurl, type);
        } else {
            console.warn("warn: skipping " + value.href + " due to ID not found");
        }
    });
    console.log("Finished locating Characters from Window");
    //console.debug(charactersData);
}

function populateCharData(charID, node, url, editurl, type) {
    charactersData[charID] = {
        node: node,
        url: charJSONurlBase + charID,
        viewurl: url,
        editurl: editurl,
        state: {
            appEnv: {
                authEndpoint: "https://auth-service.dndbeyond.com/v1/cobalt-token", characterEndpoint: "", characterId: charID, characterServiceBaseUrl: null, diceEnabled: true, diceFeatureConfiguration: {
                    apiEndpoint: "https://dice-service.dndbeyond.com", assetBaseLocation: "https://www.dndbeyond.com/dice", enabled: true, menu: true, notification: false, trackingId: ""
                }, dimensions: { sheet: { height: 0, width: 1200 }, styleSizeType: 4, window: { height: 571, width: 1920 } }, isMobile: false, isReadonly: false, redirect: undefined, username: "example"
            },
            appInfo: { error: null },
            character: {},
            characterEnv: { context: "SHEET", isReadonly: false, loadingStatus: "LOADED" },
            confirmModal: { modals: [] },
            modal: { open: {} },
            ruleData: {},
            serviceData: { classAlwaysKnownSpells: {}, classAlwaysPreparedSpells: {}, definitionPool: {}, infusionsMappings: [], knownInfusionsMappings: [], ruleDataPool: {}, vehicleComponentMappings: [], vehicleMappings: [] },
            sheet: { initError: null, initFailed: false },
            sidebar: { activePaneId: null, alignment: "right", isLocked: false, isVisible: false, panes: [], placement: "overlay", width: 340 },
            syncTransaction: { active: false, initiator: null },
            toastMessage: {}
        },
        data: {},
        type: type,
    };

    for (let ruleID in optionalRules) {
        charactersData[charID].state.serviceData.definitionPool[optionalRules[ruleID].category] = {
            accessTypeLookup: {},
            definitionLookup: {},
        };
    }
}

function getCharIDFromURL(hrefval) {
    var charID = 0;

    var matchArr = hrefval.match(charIDRegex);
    if (matchArr.length > 0) {
        var charIDStr = matchArr[1];
        if (charIDStr == "") {
            console.warn("error: empty charIdStr");
        } else {
            charID = parseInt(charIDStr);
        }
    } else {
        console.warn("error: no numbers found in " + hrefval);
    }

    return charID;
}

function insertElements() {
    console.log("Inserting Structual Elements");

    var node = $("<div id='gmstats'></div>");
    
    // decide where to insert our elements
    var sitemain = null;
    if (isCharacterPage()) {
        sitemain = $("div[name='character-app']");
    } else {
        sitemain = $("#site-main");
    }

    if (isCharacterPage()) {
        sitemain.append(node);
    } else {
        sitemain.prepend(node);
    }

    node.append(mainTableHTML);

    mainTable = $("table.primary", node);
    colStatsSubTable = $("table.stattable")

    var tableBody = $("#gm_table_body", node);
    toggleChars = $("#togglechars", node);

    for (let id in charactersData) {
        var cdata = charactersData[id].data;

        // primary row
        var row = $(tableRowHTML);
        var playerid = _genPlayerId(id);
        row.attr("id", playerid);
        row.attr("charname", cdata['name']);

        // second row
        var secondrow = $(tableSecondRowHTML);
        var secondRowId = _genSecondRowID(playerid);
        secondrow.attr("id", secondRowId);
        secondrow.addClass(HIDE_CLASS); // hidden by default

        // add rows
        tableBody.append(row);
        tableBody.append(secondrow);

        // setup refs
        charactersData[id].node = row;
        charactersData[id].node_details = secondrow;

        row.addClass(charactersData[id].type);
        secondrow.addClass(charactersData[id].type);
    };

    // highlight hover
    // TODO another thing that doesn't work very well with all the subtables and such...
    /*
    function isParentTableValid($t) {
        var parentTable = $t.parents('table');
        return (
            parentTable.length == mainTable.length 
            && parentTable.length > 0
            && parentTable[0] == mainTable[0]);
    }

    $('td', mainTable).hover(
        function () {
            var $t = $(this);
            if (!isParentTableValid($t)) return;

            var i = parseInt($t.index()) + 1;
            $('td:nth-child(' + i + ')', mainTable).addClass('hover_col');
            $('th:nth-child(' + i + ')', mainTable).addClass('hover_col');
            $t.parent().addClass('hover_row');
        },
        function () {
            var $t = $(this);
            if (!isParentTableValid($t)) return;

            var i = parseInt($t.index()) + 1;
            $('td:nth-child(' + i + ')', mainTable).removeClass('hover_col');
            $('th:nth-child(' + i + ')', mainTable).removeClass('hover_col');
            $t.parent().removeClass('hover_row');
        });
    */

    // set row as active when character name is clicked
    $('td.col_name', tableBody).click(function (e) {
        var node = $(this, node);
        var nameNode = $(".name", node)[0];
        var $target = $(e.target);
        if ((e.target !== this && $target.is('a')) && e.target !== nameNode) {
            // don't exec this if we click on a child element other than the name
            return;
        }

        var row = node.parent();

        // toggle right away on click to check active status for everything else
        row.toggleClass(ACTIVE_ROW_CLASS);

        var playerid = row.attr('id');
        var isActive = row.hasClass(ACTIVE_ROW_CLASS);

        // save right away on click
        _setGMValue(ACTIVE_ROW_VAR_NAME_PREFIX + playerid, isActive);

        updateRowIfShouldBeActive(row);

        e.preventDefault();
    });

    // force data refresh on click
    $("#force_refresh", node).click(function ($e) {
        console.log("Force Refresh...");
        refreshTimer_startForceRefresh();

        $e.preventDefault();
    });

    // toggle dark style for the rest of the site
    const siteNode = $("#site-main");
    const gm_dark_mode = 'gm-dark-mode';
    const darkBtn = $("#dark_mode_toggle", node);
    initSimpleStyleToggleButton(siteNode, darkBtn, gm_dark_mode);

    // toggle vertical scrollbar
    const bodyNode = $("body");
    const gm_no_scroll = 'gm-no-scroll';
    const scrollBtn = $("#scroll_toggle", node);
    initSimpleStyleToggleButton(bodyNode, scrollBtn, gm_no_scroll, (newVal) => {
        // safari is dumb and we have to force a refresh to get the scrollbar to hide -.-
        if (IS_SAFARI && !IS_CHROME) {
            console.log('Safari Shenanigans Start');
            $("html").css('display', 'none');

            setTimeout(function () {
                $("html").css('display', '');
                console.log('Safari Shenanigans End');
            }, 100);
        }
    });

    // toggle game log
    const sideBarNode = $("div.sidebar");
    const sideBarBtn = $('#log_toggle', node);
    initSimpleStyleToggleButton(sideBarNode, sideBarBtn, HIDE_CLASS);

    // toggle table header
    const tableHeaderNode = $("table.primary > thead", node);
    const tableHeaderBtn = $("#header_toggle", node);
    initSimpleStyleToggleButton(tableHeaderNode, tableHeaderBtn, HIDE_CLASS);

    // hide site banners
    const bannerNode = $("body > .ddb-site-banner");
    const bannerBtn = $("#banner_toggle", node);
    initSimpleStyleToggleButton(bannerNode, bannerBtn, HIDE_CLASS);

    // ------------
    // modify for char page if need be
    if (isCharacterPage()) {
        const totals = $("#totals", node);
        totals.addClass(NO_DISPLAY_CLASS);

        $("#foot3", mainTable).addClass("charpage");
    }
}

/**
 * Note: btnNode requires an id attribute for gmvalue saving/loading to work properly!
 */
function initSimpleStyleToggleButton(targetNode, btnNode, className, func = null) {
    var doesTargetExist = targetNode.length > 0;
    var varName = `{0}__{1}`.format(btnNode.attr('id'), className);

    btnNode.click(function ($e) {
        var isActive = false;
        if (doesTargetExist) {
            isActive = targetNode.hasClass(className);

            targetNode.toggleClass(className);
        } else {
            isActive = isButtonToggleActive(btnNode);
        }

        isActive = !isActive;

        _setGMValue(varName, isActive);
        updateButtonToggleState(isActive, btnNode);

        if (func !== null) {
            func(isActive);
        }

        $e.preventDefault();
    });

    var isStartActiveVal = _getGMValueOrDefault(varName, false);
    if (isStartActiveVal) {
        if (doesTargetExist) {
            targetNode.addClass(className);
        }
        updateButtonToggleState(isStartActiveVal, btnNode);
    }

    if (func) {
        func(isStartActiveVal);
    }
}

function retriveRules(charIDs) {
    return new Promise(function (resolve, reject) {
        console.log("Retriving Rules Data");
        getJSONfromURLs(rulesUrls).then((js) => {
            console.log("Rules Data Processing Start");
            js.forEach(function (rule, index) {
                isSuccessfulJSON(rule, index);
            });
            rulesData = {
                ruleset: js[0].data,
                vehiclesRuleset: js[1].data
            }
            for (let id in charactersData) {
                charactersData[id].state.ruleData = rulesData.ruleset;
                charactersData[id].state.serviceData.ruleDataPool = rulesData.vehiclesRuleset;
            }
            console.debug("Rules Data:");
            console.debug(rulesData);
            resolve();
        }).catch((error) => {
            reject(error);
        });
    });
}

function getRules(index) {
    return rulesData[index];
}

function updateAllCharData() {
    // load the module loader which imports from window.jsonpDDBCT and the inputted modules
    loadModules(initalModules); // necessary each time to update things like skill adv/disadv

    window.moduleExport.getAuthHeaders()().then((function (headers) {
        authHeaders = headers;
        console.log("authHeaders: ", headers);
        retriveRules().then(() => {
            _updateAllCharDataAfterRules();
        }).catch ((error) => {
            console.log(error);
        });
    }));
}

function _updateAllCharDataAfterRules() {
    console.log("Retriving Each Char Data");

    let promises = []
    for (let id in charactersData) {
        promises.push(updateCharData(charactersData[id].url, charactersData[id].type));
    }

    Promise.all(promises)
        .then(() => {
            var totalsRow = updateCampaignData();
            refreshTimer__checkShouldStart(refreshTimer__getAutoUpdateChecked());

            applyTooltips(parentNode = totalsRow);
        }).catch((error) => {
            console.log(error);
        });

    console.log("Updated All Char Data");
}

function updateCharData(url, activeType) {

    return new Promise(function (resolve, reject) {
        console.log("Retrieving Char Data");

        getJSONfromURLs([url]).then((js) => {
            //window.jstest = js;
            var totalChars = js.length;
            js.forEach(function (charJSON, index) {
                if (isSuccessfulJSON(charJSON, index)) {
                    let charId = charJSON.data.id;
                    console.debug("Processing Char: " + charId);
                    charactersData[charId].state.character = charJSON.data;
                    let promises = retriveCharacterRules(charId)
                    Promise.all(promises).then(() => {
                        var charData = window.moduleExport.getCharData(charactersData[charId].state);
                        charactersData[charId].data = charData;
                        updateElementData(charactersData[charId], charId);
                        console.log("{0} [{1}]:\n\nCharacter Data Returned! \n".format(charactersData[charId].data.name, charId), charactersData[charId]);

                        applyTooltips(parentNode = charactersData[charId].node);
                        applyTooltips(parentNode = charactersData[charId].node_details);
                        resolve();
                    });
                } else {
                    console.log("Char URL " + url + " was skipped");
                }
            });
        }).catch((error) => {
            console.log(error);
            reject();
        });
    });

}

function retriveCharacterRules(charId) {
    let promises = [];
    console.log("Looking for optional rules for " + charactersData[charId].data.name);
    for (let ruleID in optionalRules) {
        if (ruleID in charactersData[charId].state.character && charactersData[charId].state.character[ruleID].length > 0) {
            console.log("Optional ruleset for " + ruleID + " found.");
            promises.push(retriveCharacterRule(charId, ruleID));
        }
    }
    return promises;
}

function retriveCharacterRule(charId, ruleID) {
    let url = gameCollectionUrl.prefix + optionalRules[ruleID].category + gameCollectionUrl.postfix;

    let ruleIds = []
    for (let item of charactersData[charId].state.character[ruleID]) {
        ruleIds.push(item[optionalRules[ruleID].id]);
    }

    let body = {
        "campaignId": null,
        "sharingSetting": 2,
        "ids": ruleIds
    };
    return new Promise(function (resolve, reject) {
        getJSONfromURLs([url], body).then((js) => {
            js.forEach(function (charJSON, index) {
                console.log("Retrived " + ruleID + " data, processing.");
                console.log(charJSON);
                if (charJSON.success && charJSON.data.definitionData != undefined) {
                    for (let data of charJSON.data.definitionData) {
                        charactersData[charId].state.serviceData.definitionPool[optionalRules[ruleID].category].definitionLookup[data.id] = data;
                        charactersData[charId].state.serviceData.definitionPool[optionalRules[ruleID].category].accessTypeLookup[data.id] = 1;
                    }
                }
                console.log(ruleID + " finished processing.");
            });
            resolve();

        }).catch((error) => {
            console.log(error);
            reject();
        });
    });
}

function isCharacterPage() {
    if (__isCharPage == null) {
        __isCharPage = window.location.href.toLowerCase().includes('characters');
    }

    return __isCharPage;
}

function getCharacterPageCharID() {
    let r = window.location.pathname.match(/\/(\d+).*?$/);

    if (r.length > 1) {
        return r[1];
    }

    return '';
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Refresh timer
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function initRefreshTimer() {
    console.log('[0] init refresh timer');

    var controls = $(".gs-controls");

    refresh_autoUpdateNode = $('input[name ="gs-auto-update"]', controls);
    refresh_minTimeNode = $('input[name ="gs-auto-duration"]', controls);

    var pbar = $(".progress-wrapper", controls);
    refresh_progressBarContents = $(".progress-bar-fill", pbar);
    refresh_progressBarCurr = $(".curr", pbar);
    refresh_progressBarTotal = $(".total", pbar);
    refresh_progressBarPct = $(".pct", pbar);

    console.log('[1] init refresh timer',
        '\ninputs', refresh_autoUpdateNode, refresh_minTimeNode,
        '\npbar contents', refresh_progressBarContents,
        '\npbar curr/total', refresh_progressBarCurr, refresh_progressBarTotal
    );

    refreshTimer__checkShouldStart(refreshTimer__getAutoUpdateChecked());
}

function refreshTimer__getAutoUpdateChecked() {
    return parseBool($(refresh_autoUpdateNode).prop("checked"));
}

function refreshTimer__checkShouldStart(val) {
    if (refreshTimer_isActive() != val) {
        refresh_isUpdateActive = val;
        refreshTimer__gse(val);
    }

    refreshTimer_endForceRefresh(val);

    if (val) {
        refreshTimer_start();
    } else {
        refreshTimer_end();
    }
}

function refreshTimer__gse(val=null) {
    var v = GACT.NOW;
    if (val != null) {
        v = val ? GACT.START : GACT.END;
    }

    gse(GCAT.AUTOREF, v, GLAB.SET_ACTIVE, Math.floor(refreshTimer_getMinTime()/1000));
}

function refreshTimer_start() {
    var isActive = refreshTimer_isActive();
    // console.log("refreshTimer_start: ", isActive);
    if (isActive) {
        refreshTimer_end();
    }

    refreshTimer_setActive(true);
    refresh_timeSinceLastRefresh = 0;
    refreshTimer_tockNext();
}

function refreshTimer_end() {
    var isActive = refreshTimer_isActive();
    // console.log("refreshTimer_end: ", isActive);
    if (!isActive) {
        return;
    }

    clearTimeout(refresh_currentTimer);
    refresh_timeSinceLastRefresh = 0;
    refresh_currentTimer = null;
    refreshTimer_setActive(false);

    refreshTimer_updatePbar();
}

function refreshTimer_isActive() {
    return refresh_isTimerActive;
}

function refreshTimer_setActive(newState) {
    refresh_isTimerActive = newState;
}

function refreshTimer_tock() {
    refresh_timeSinceLastRefresh += tockDuration * 1000;

    var minTime = refreshTimer_getMinTime();
    var isActive = refreshTimer_isAutoUpdateActive();

    // console.log('refreshTimer_tock', 
    //     'isActive:', isActive,
    //     'minTime:', minTime / 1000,
    //     'timeSinceLast:', timeSinceLastRefresh / 1000
    // );

    if (refresh_timeSinceLastRefresh < minTime || !isActive) {
        refreshTimer_tockNext();
        return;
    }

    refreshTimer_updatePbar();

    refreshTimer__gse();

    updateAllCharData();
}

function refreshTimer_tockNext() {
    refreshTimer_updatePbar();
    refresh_currentTimer = setTimeout(refreshTimer_tock, tockDuration * 1000);
}

/** time in milliseconds */
function refreshTimer_getMinTime() {
    let refreshTime = _getGMValueOrDefault("-updateDuration", 30);
    let refreshTimeMiliSecs = refreshTime * 1000;

    return refreshTimeMiliSecs;
}

function refreshTimer_isAutoUpdateActive() {
    return refresh_autoUpdateNode.is(':checked');
}

function refreshTimer_updatePbar() {
    var minTime = refreshTimer_getMinTime();
    var curTime = refresh_timeSinceLastRefresh;
    var pct = Math.floor(curTime / minTime * 100);

    refreshTimer_setPbar(pct, minTime, curTime);
}

function refreshTimer_setPbar(pct, minTime, curTime) {
    // use scale instead of width for performance https://developers.google.com/web/updates/2017/03/performant-expand-and-collapse
    // TODO if i care about maing the edges un-squished with scale: https://pqina.nl/blog/animating-width-and-height-without-the-squish-effect/
    refresh_progressBarContents.attr('style', "width: 100%; transform: scaleX({0});".format(pct/100))
    // refresh_progressBarCurr.html(Math.round(curTime / 1000));
    // refresh_progressBarCurr.html();
    refresh_progressBarTotal.html(Math.round((minTime - curTime) / 1000));
    // refresh_progressBarPct.html("{0}%".format(Math.round(pct)));
}

function refreshTimer_startForceRefresh() {
    if (refresh_isForceRefresh) {
        return;
    }

    refresh_isForceRefresh = true;
    updateAllCharData();

    gset(GCAT.REF, GACT.NOW, GLAB.UPDATE_CHAR);

    refreshTimer_setPbar(100, 0, 0);
    $("#force_refresh").attr('disabled', 'disabled');
}

function refreshTimer_endForceRefresh(isAutoRefreshActive) {
    if (refresh_isForceRefresh) {
        refresh_isForceRefresh = false;
        $("#force_refresh").removeAttr('disabled', 'disabled');

        if (!isAutoRefreshActive) {
            refreshTimer_setPbar(0, 0, 0);
        }
    }
}

document.addEventListener("visibilitychange", pageTimer_OnVis);

function initPageTimer() {
    pageTimer_OnVis();
}

function pageTimer_OnVis() {
    if (document.visibilityState == DOC_VIS) {
        clearInterval(page_currentInterval);

        pageTimer_Tock();
        page_currentInterval = setInterval(pageTimer_Tock, 30 /* seconds */ * 1000);
    } else if (document.visibilityState == DOC_HID) {
        clearInterval(page_currentInterval);
    }
}

function pageTimer_Tock() {
    if (document.visibilityState != DOC_VIS) {
        return;
    }
    gset(GCAT.PING, GACT.NOW);
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Element Updating Functions
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function insertCampaignElements() {
    console.log("Inseting Campaign Elements");
    campaignNode = mainTable;
    insertControls(campaignNode);
    // insertVisibilityControls(campaignNode, campaignPrefix);
    // insertStoredElements(campaignNode, campaignPrefix);

}

function insertControls(parent) {
    console.log("Inserting Main Controls");

    let controlsNode = parent.find('.gs-controls');

    let autoUpdate = controlsNode.find('input[name ="gs-auto-update"]');
    let autoDuration = controlsNode.find('input[name ="gs-auto-duration"]');
    let shortDuration = controlsNode.find('#time_short');
    let longDuration = controlsNode.find('#time_long');
    let verylongDuration = controlsNode.find('#time_verylong');
    let fontSize = controlsNode.find('select[name ="gs-font-size"]');

    let displayDeactive = controlsNode.find('input[name ="gs-display-deactive"]');
    let displayUnassigned = controlsNode.find('input[name ="gs-display-unassigned"]');

    // Loads ideally value set for this campaign, if not found it loads the last saved value otherwise it defaults
    let autoUpdateLoaded = _getGMValueOrDefault("-autoUpdate", autoUpdateDefault);
    let updateDurationLoaded = _getGMValueOrDefault("-updateDuration", updateDurationDefault);
    let fontSizeSettingLoaded = _getGMValueOrDefault("-fontSize", fontSizeDefault);

    let displayDeactiveSettingLoaded = _getGMValueOrDefault("-displaydeactive", displayDeactiveDefault);
    let displayUnassignedSettingLoaded = _getGMValueOrDefault("-displayunassigned", displayUnassignedDefault);

    autoUpdate.prop('checked', autoUpdateLoaded);
    autoDuration.prop('value', updateDurationLoaded);
    fontSize.val(fontSizeSettingLoaded).change();
    onFontSizeChange(mainTable, fontSizeSettingLoaded);
    onFontSizeChange(colStatsSubTable, fontSizeSettingLoaded);
    onFontSizeChange($("table.secondary", mainTable), fontSizeSettingLoaded);

    displayDeactive.prop('checked', displayDeactiveSettingLoaded);
    displayUnassigned.prop('checked', displayUnassignedSettingLoaded);
    onDisplayTypeChange('deactivated', displayDeactiveSettingLoaded);
    onDisplayTypeChange('unassigned', displayUnassignedSettingLoaded);

    updateSiblingLabelToggleState(autoUpdateLoaded, autoUpdate);
    autoUpdate.change(function () {
        var $this = $(this);
        let val = parseBool($this.prop("checked"));

        _setGMValue("-autoUpdate", val);
        
        if (refreshTimer_isActive() != val) {
            refreshTimer__checkShouldStart(val);
        }

        updateSiblingLabelToggleState(val, $this);
    });
    autoDuration.change(function () {
        let val = parseIntSafe($(this).val());

        // set a reasonable lower bound
        if (val <= 10) {
            $(this).val(10);
            val = 10;
        }

        _setGMValue("-updateDuration", val);
    });

    // duration buttons
    function onDurationClick(e) {
        var time = e.data.time;
        console.log("Set Timer: ", time);
        autoDuration.prop('value', time).change();
        autoUpdate.prop('checked', true).change();

        e.preventDefault();
    }
    shortDuration.click({ time: 30 }, onDurationClick);
    longDuration.click({ time: 90 }, onDurationClick);
    verylongDuration.click({ time: 150 }, onDurationClick);
    // end duration buttons

    fontSize.change(function () {
        let val = parseIntSafe($(this).val());
        _setGMValue("-fontSize", val);

        onFontSizeChange(mainTable, val);
        onFontSizeChange(colStatsSubTable, val);
        onFontSizeChange($("table.secondary", mainTable), val);
    });

    updateSiblingLabelToggleState(displayDeactiveSettingLoaded, displayDeactive);
    displayDeactive.change(function () {
        let val = parseBool($(this).prop("checked"));
        _setGMValue("-displaydeactive", val);

        onDisplayTypeChange('deactivated', val);

        updateSiblingLabelToggleState(val, displayDeactive);
    });

    updateSiblingLabelToggleState(displayUnassignedSettingLoaded, displayUnassigned);
    displayUnassigned.change(function () {
        let val = parseBool($(this).prop("checked"));
        _setGMValue("-displayunassigned", val);

        onDisplayTypeChange('unassigned', val);

        updateSiblingLabelToggleState(val, displayUnassigned);
    });
}

function onFontSizeChange(table, updatedFontSize) {
    var $b = $("body");

    function bodyClass(c) {
        return "tooltipster-carm__{0}".format(c)
    }

    for (const idx in fontSizeMap) {
        if (table.hasClass(fontSizeMap[idx])) {
            table.removeClass(fontSizeMap[idx]);
        }

        var bc = bodyClass(fontSizeMap[idx]);
        if ($b.hasClass(bc)) {
            $b.removeClass(bc);
        }
    }

    var newFontClass = fontSizeMap[updatedFontSize];
    table.addClass(newFontClass);
    $b.addClass(bodyClass(newFontClass));
}

function onDisplayTypeChange(type, newval) {
    var rows = $("tr." + type, mainTable);

    if (newval) {
        rows.removeClass(HIDE_CLASS);
    } else {
        rows.addClass(HIDE_CLASS);
    }
}

function updateCampaignData() {
    // sort table by char name
    // sortTable(mainTable, 'asc');
    // TODO maybe readd table sort later... gotta figure out a way to make it not
    //      suck out sub-table rows into the main table

    // calc totals
    var totalsRow = $("#totals", mainTable);
    globalCurrencies = {};
    globalLanguages = [];

    var len = Object.keys(charactersData).length;

    var idx = 0;
    for (let id in charactersData) {
        var curChar = charactersData[id];

        var charData = charactersData[id].data;
        var charType = charactersData[id].type;

        if (charType == 'active') {
            // update global counters
            // -------------------------------------------------------

            // money
            $.each(charData.currencies, (key, val) => {
                if (key in globalCurrencies) {
                    globalCurrencies[key] += val;
                } else {
                    globalCurrencies[key] = val;
                }
            });

            // languages
            updateLanguages(
                totalsRow,
                charData.proficiencyGroups,
                globalLanguages,
                updateHtml = isLastChar);
        }

        var isLastChar = idx == len - 1;
        if (isLastChar) {
            updateMoney(totalsRow, globalCurrencies, showSumOnly=true, updateTotalsTooltip=true);
        }

        idx++;
    }

    return totalsRow;
}


function updateElementData(allCharData, charId) {
    const character = allCharData.data;
    const parent = allCharData.node;
    const parent_secondrow = allCharData.node_details;

    console.log('update info: ', charId, character);

    addOrUpdateToggleButton(charId, character.name);

    updateNameBlock(parent, allCharData, character);
    updateHitPointInfo(parent, character.hitPointInfo, character.deathSaveInfo);
    updateArmorClass(parent, character.armorClass, character.initiative, character.hasInitiativeAdvantage);
    updateSpeeds(parent, character);

    updateAbilties(parent, character.abilities);
    updatePassives(parent, character.passivePerception, character.passiveInvestigation, character.passiveInsight);
    updateMoney(parent, character.currencies, showSumOnly=false, updateTotalsTooltip=true);
    updateSkillProfs(parent, parent_secondrow, character.skills, character.customSkills);
    updateLanguages(parent, character.proficiencyGroups);
    updateDefenses(parent, character);

    updateJump(parent_secondrow, character);

    updateRowIfShouldBeActive(parent);
}

function updateRowIfShouldBeActive(primaryRow) {
    var playerId = primaryRow.attr('id');
    var secondrow = $('#{0}'.format(_genSecondRowID(playerId)), primaryRow.parent());

    var col_name = $('td.col_name', primaryRow);
    var col_skills = $('td.col_skills', primaryRow);
    var col_langs = $('td.col_languages', primaryRow);
    var col_money = $('td.col_money', primaryRow);

    var col_langs_title = $("." + ACTIVE_ROW_TITLE_CLASS, col_langs);
    var col_langs_hr = $(".langshr", col_langs);
    var col_langs_resset = $(".resset", col_langs);
    var col_langs_immset = $(".immset", col_langs);
    var col_langs_vulnset = $(".vulnset", col_langs);
    var col_langs_saveset = $(".saveset", col_langs);

    var col_money_expanded = $(".expanded", col_money);
    var col_money_total = $(".total", col_money);
    
    var isActive = _getGMValueOrDefault(ACTIVE_ROW_VAR_NAME_PREFIX + playerId, false);

    // console.log('update row, player:', playerId, '\nprimary', primaryRow, '\nsecond', secondrow, '\nisActive', isActive);
    if (isActive) {
        // show details
        primaryRow.addClass(ACTIVE_ROW_CLASS);
        primaryRow.addClass(ACTIVE_FIRST_ROW_CLASS);

        secondrow.removeClass(HIDE_CLASS);

        col_name.attr('rowspan', '2');
        col_skills.addClass(HIDE_CLASS);

        col_langs.attr('colspan', '2');
        col_langs_title.removeClass(HIDE_CLASS);
        col_langs_hr.removeClass(HIDE_CLASS);
        col_langs_resset.removeClass(HIDE_CLASS);
        col_langs_immset.removeClass(HIDE_CLASS);
        col_langs_vulnset.removeClass(HIDE_CLASS);
        col_langs_saveset.removeClass(HIDE_CLASS);

        col_money_expanded.removeClass(HIDE_CLASS);
    } else {
        // hide details
        primaryRow.removeClass(ACTIVE_ROW_CLASS);
        primaryRow.removeClass(ACTIVE_FIRST_ROW_CLASS);

        secondrow.addClass(HIDE_CLASS);

        col_name.attr('rowspan', '1');
        col_skills.removeClass(HIDE_CLASS);

        col_langs.attr('colspan', '1');
        col_langs_title.addClass(HIDE_CLASS);
        col_langs_hr.addClass(HIDE_CLASS);
        col_langs_resset.addClass(HIDE_CLASS);
        col_langs_immset.addClass(HIDE_CLASS);
        col_langs_vulnset.addClass(HIDE_CLASS);
        col_langs_saveset.addClass(HIDE_CLASS);
        
        // only hide the money expanded section, if we have no 'total' summary calculated
        var cmtHtml = col_money_total.html();
        if (cmtHtml.length > 0) {
            col_money_expanded.addClass(HIDE_CLASS);
        }
    }

    updateNameTooltip($(".name", primaryRow), isActive);
}

function updateNameTooltip(node, activeState) {
    editTooltipLabel(node, activeState ? "Hide details" : "Show details");
}

function updateNameBlock(parent, allCharData, character) {
    var nameblock = parent.find('td.col_name');

    $(".name", nameblock).html(character.name);

    updateNameBlockViewEditLinks(allCharData, nameblock);

    updateNameBlockExhaust(character, nameblock);

    updateNameBlockSaveDC(character, nameblock);

    updateNameBlockInspiration(character, nameblock);

    updateNameBlockProfBonus(character, nameblock);

    updateNameBlockConditions(character, nameblock);
}

function updateNameBlockViewEditLinks(allCharData, nameblock) {
    const links = $(".links", nameblock);
    const view = $(".view", links);
    const edit = $(".edit", links);

    displayIfUrlExists(allCharData.viewurl, view);
    displayIfUrlExists(allCharData.editurl, edit);

    editTooltipLabel(view.parent(), "View {0}".format(allCharData.data.name));
    editTooltipLabel(edit.parent(), "Edit {0}".format(allCharData.data.name));
}

function canEditCharacter(allCharData) {
    return character.editurl !== null && character.editurl.length > 0;
}

function displayIfUrlExists(url, node, hideClass = HIDE_CLASS) {
    if (url !== null && url.length > 0) {
        node.removeClass(hideClass);
        node.attr('href', url);
    } else {
        node.addClass(hideClass);
        node.attr('href', '');
    }
}

function updateNameBlockInspiration(character, nameblock) {
    if (character.inspiration) {
        $(".inspiration", nameblock).removeClass(HIDE_CLASS);
    } else {
        $(".inspiration", nameblock).addClass(HIDE_CLASS);
    }
}


function updateNameBlockProfBonus(character, nameblock) {
    $(".pbval", $(".profbonus", nameblock)).html(
        "{0}{1}".format(getSign(character.proficiencyBonus), character.proficiencyBonus)
    );
}

function updateNameBlockConditions(character, nameblock) {
    var condNode = $(".conditions", nameblock);
    var conditions = [];

    // figure out which non-exhaust conditions are effecting us if any
    character.conditions.forEach((item, idx) => {
        if (item.definition.slug == 'exhaustion') {
            return;
        }

        conditions.push(item.definition);
    });

    if (conditions.length == 0) {
        condNode.addClass(HIDE_CLASS);
        return;
    } 
    
    // unhide the overall block, and then individual conditions
    condNode.removeClass(HIDE_CLASS);

    function getCondClassName(name) {
        return "cond_" + name.toLowerCase();
    }

    $(".cond", condNode).addClass(HIDE_CLASS);

    conditions.forEach((c, idx) => {
        var name = c.name;
        var desc = c.description;

        var cond = $("." + getCondClassName(name), condNode);

        var condSpan = cond.parent();
        condSpan.removeClass(HIDE_CLASS);

        // we apply the tooltip/title here because we want to always be up to date with the backend,
        // instead of hard-coding it in the html above
        condSpan.attr('title', `<span class="title cap normal">{0}</span>:{1}`.format(name, desc));
    });
}

function updateNameBlockExhaust(character, nameblock) {
    const maxExhaust = 6;

    var conditions = character.conditions;
    var isExhausted = false;
    var exhaustLevel = 0;

    var exhaustData = null;
    conditions.forEach((item, idx) => {
        if (item.definition.slug == 'exhaustion') {
            isExhausted = true;
            exhaustLevel = item.level;

            exhaustData = item;
        }
    });

    const exhaustBlock = $(".exhaust", nameblock);
    if (isExhausted) {
        var exhaustStr = "";
        for (var i = 0; i < exhaustLevel; i++) {
            exhaustStr += "• ";
        }

        var restStr = "";
        for (var i = 0; i < (maxExhaust - exhaustLevel); i++) {
            restStr += "- ";
        }

        // build tooltip text
        var tipStr = `<div class="title cap">Exhaustion Lvl <code>{0}</code></div>`.format(exhaustLevel);
        if (exhaustData !== null) {
            var exhaustItems = "";

            exhaustData.levels.forEach((item, idx) => { 
                if (item.definition.level <= exhaustLevel) {
                    exhaustItems += `<li class="nob"><span class="disadv">{0}</span>: {1}</li>`.format(item.definition.level, item.definition.effect);
                }
            });

            tipStr += `<ul>{0}</ul>`.format(exhaustItems);
        }

        exhaustBlock.removeClass(HIDE_CLASS);
        exhaustBlock.html(
            `<span {2}><span class="ex">{0}</span>{1}</span>`.format(
                exhaustStr,
                restStr,
                insertTooltipAttributes(tipStr)
                //, GET_SVG_URI_AS_OBJECT(SVG_C_EXHAUSTION) 
            ));
    } else {
        exhaustBlock.addClass(HIDE_CLASS);
        exhaustBlock.html('');
    }
}

function updateNameBlockSaveDC(character, nameblock) {
    // add any class save DCs
    var classes = character.classes;
    var spellCasterSaveDCs = character.spellCasterInfo.castingInfo.saveDcs;

    var savestr = [];
    var remainingClassNames = {};
    for (var i = 0; i < classes.length; i++) {
        var c = classes[i];
        var slug = c.slug;

        if (slug == 'monk') {
            // special case for ki since it doesn't seem to show up in data
            // ki save DC = 8 + your proficiency bonus + your Wisdom modifier
            var dc = 8;
            dc += character.proficiencyBonus;

            // TODO should this be done programmatically?
            // abilities[4] == 'wis', dnd beyond id == 5 == 'wis'
            dc += character.abilities[4].modifier;

            savestr.push("{0} <span class='lvl'>{1}</span>: <span class='dc'>{2}</span>".format(c.definition.name, c.level, dc));

            continue;
        }

        remainingClassNames[slug] = "{0} <span class='lvl'>{1}</span>".format(c.definition.name, c.level);
    }

    for (var i = 0; i < spellCasterSaveDCs.length; i++) {
        var c = spellCasterSaveDCs[i]
        var val = c.value;

        for (var j = 0; j < c.sources.length; j++) {
            var cname = c.sources[j].definition.name;

            savestr.push("{0} <span class='lvl'>{1}</span>: <span class='dc'>{2}</span>".format(cname, c.sources[j].level, val));

            if (c.sources[j].slug in remainingClassNames) {
                delete remainingClassNames[c.sources[j].slug];
            }
        }
    }

    var savedcnode = $(".spellsavedc", nameblock);

    for (const key in remainingClassNames) {
        savestr.push(remainingClassNames[key]);
    }

    savedcnode.html(savestr.join("<br />"));
}

function updateHitPointInfo(parent, hitPointInfo, deathSaveInfo) {
    var hp = parent.find('td.col_hp');

    // hp -------------------------------------------------
    var max = hitPointInfo.totalHp;
    var remaining = hitPointInfo.remainingHp;

    var hasbonus = false;
    var bonus = 0;
    if (hitPointInfo.bonusHp !== null && hitPointInfo.bonusHp > 0) {
        bonus = hitPointInfo.tempHp;

        remaining += bonus;

        hasbonus = true;
    }

    var hastemp = false;
    var temp = 0;
    if (hitPointInfo.tempHp !== null && hitPointInfo.tempHp > 0) {
        temp = hitPointInfo.tempHp;

        remaining += temp;

        hastemp = true;
    }

    var pct_left = remaining / max * 100;

    var hpColor = 'normal';
    if (pct_left < 50) hpColor = 'bad';
    else if (pct_left < 75) hpColor = 'hurt';
    else if (pct_left < 100) hpColor = 'good';
    else if (pct_left > 100) hpColor = 'overheal';
    else hpColor = 'normal';

    var bonus_str = "";
    if (hasbonus) {
        bonus_str = "<br />bonus: <span class='overheal'>{0}</span>".format(bonus);
    }

    var temp_str = "";
    if (hastemp) {
        temp_str = "<br />temp: <span class='overheal'>{0}</span>".format(temp);
    }

    // death saves ------------------------------------------
    var fails = deathSaveInfo.failCount;
    var success = deathSaveInfo.successCount;
    var stable = deathSaveInfo.isStabilized;

    var dsstr = "";
    if (stable || (success >= 3)) {
        dsstr = "<br />--<span class='stable'>stable</span>--"
    } else if (fails > 0 || success > 0) {
        if (fails > 0) {
            dsstr += "<br />F: <span class='fail'>{0}</span>".format(fails);
        }

        if (success > 0) {
            dsstr += "<br />S: <span class='save'>{0}</span>".format(success);
        }
    }

    // hit dice display
    var hitDiceStr = "";
    var hitDiceMap = {}; // dice type -> count
    var hitDiceUsed = {}; // dice type -> # used
    var hitDiceClasses = {}; // dice type -> [class1, class2, ...]
    hitPointInfo.classesHitDice.forEach((item, idx) => {
        var val = item.dice.diceValue;
        var total = item.dice.diceCount;
        var used = item.charClass.hitDiceUsed;

        if (!(val in hitDiceMap)) { hitDiceMap[val] = 0; }
        if (!(val in hitDiceUsed)) { hitDiceUsed[val] = 0; }
        if (!(val in hitDiceClasses)) { hitDiceClasses[val] = []; }

        hitDiceMap[val] += total;
        hitDiceUsed[val] += used;
        hitDiceClasses[val].push(item.charClass.definition.name);
    });

    var hdArr = []
    for (const [key, val] of Object.entries(hitDiceMap)) {
        var numLeft = val - hitDiceUsed[key];

        var diceColor = '';
        if (numLeft == val) {
            diceColor = ' unused';
        } else if (numLeft == 0) {
            diceColor = ' empty';
        } else {
            diceColor = ' used';
        }

        var diceVal = '';
        if (numLeft == val) {
            diceVal = '{0}'.format(numLeft);
        } else {
            diceVal = '{0}&frasl;{1}'.format(numLeft, val);
        }
        
        var fStr = `<span class='hitdice{2}'><span class='num'>{0}</span> × <span class='dicetype'>d{1}</span></span>`.format(
            diceVal,
            key,
            diceColor
        );

        hdArr.push(addTooltip(
            fStr,
            "<code>{0}d{1}</code> Hit Dice via {2}".format(
                val,
                key,
                hitDiceClasses[key].join(', ')
            )
        ));
    }

    hitDiceStr += "<div class='hitdicecontainer'>{0}</div>".format(hdArr.join('<br />'));

    // put it all together

    hp.html(
        `<span class="{0}">{1}</span>{2}{3}{4}{5}`
        .format(
            hpColor,
            "{0}/{1} {2}%".format(remaining, max, Math.round(pct_left)),
            bonus_str,
            temp_str,
            dsstr,
            hitDiceStr
        )
    );
}

function updateArmorClass(parent, armorClass, init, hastInitAdv) {
    var node = parent.find('td.col_ac');
    $(".acval", node).html(armorClass);

    var initAdv = '';
    if (hastInitAdv) {
        initAdv = "<br />{0}".format(GET_SVG_AS_ICON(SVG_ADVANTAGE));
    }

    var initValNode = $(".initval", node);
    initValNode.html(
        "{0}{1}{2}".format(
            getSign(init),
            Math.abs(init),
            initAdv
        ));
    
    updateTooltipText(initValNode, hastInitAdv ? TOOLTIP_INIT_ADV : TOOLTIP_INIT_NORMAL);
}

/*
function updateInitiative(parent, initiative){
    parent.find('.gs-intv-sign').html(getSign(initiative));
    parent.find('.gs-intv-number').html(Math.abs(initiative));
}
*/

function updateSpeeds(parent, character) {
    // speed
    var node = parent.find('td.col_speed');
    node.empty();

    var speeds = character.speeds;
    var speedarr = [];
    speeds.forEach(function (item, index) {
        if (item.distance > 0) {
            speedarr.push("<span>{0}</span> {1}".format(item.distance, item.key));
        }
    });

    node.append(speedarr.join("<br />"));

    // do we have dark vision or similar??
    var senses = character.senses;
    var sensearr = [];
    for (var i = 0; i < senses.length; i++) {
        var s = senses[i];

        if (s.distance > 0) {
            var name = senseToName[s.key];

            if (s.key == 'passive-perception') {
                // no need to display passive perception since it'll
                // get rolled up into the column with all the other passives
                continue;
            }

            // var distUnits = distanceUnit(s.distance);
            sensearr.push(
                addTooltip(
                    "{0}: <span>{1}</span>".format(name, s.distance),
                    s.key,
                    tag = "div"
                ));
        }
    }

    if (sensearr.length > 0) {
        node.append("<br />");
        node.append(sensearr.join(""));
    }
}

function updateAbilties(parent, abilities) {
    abilities.forEach(function (item, index) {
        var abilityKey = item.name;
        var cellName = ".col_" + abilityKey;

        var cell = $(cellName, parent);
        cell.empty();

        // title
        cell.append('<div class="stat_title">{0}</div>'.format(abilityKey))

        // stat
        cell.append("<span class='high' {1}>{0}</span><br />".format(item.totalScore === null ? -1 : item.totalScore));//, insertTooltipAttributes(abilityKey + ' score')));

        // bonus
        var mod = item.modifier;
        var color = "";
        if (mod > 0) { color = "high"; }
        else if (mod < 0) { color = "low"; }

        cell.append("<span class='{0}' {3}>{1}{2}</span><br />".format(color, getSign(mod), Math.abs(mod)));//, insertTooltipAttributes(abilityKey + ' bonus')));

        // save
        // we only show one's we're proficient in or are different than the bonus
        var save = item.save;
        var isprof = item.proficiency;
        color = "";

        if (isprof) { color = "prof"; }
        else if (save > 0) { color = "high"; }
        else if (save < 0) { color = "low"; }

        if (!isprof && mod == save) {
            color += " same";
        }

        // if (isprof || mod != save) {
            cell.append("<span class='{0}' {3}>{1}{2}</span><br />".format(color, getSign(save), Math.abs(save)));//, insertTooltipAttributes(abilityKey + ' save')));
        // }
    });
}

function updatePassives(parent, passPerception, passInvestigation, passInsight) {
    parent.find("td.col_passives").html("{0}{1}{2}".format(
        addTooltip(
            "per: <span>{0}</span><br />".format(passPerception),
            "Passive Perception",
            tag = "div"),
        addTooltip(
            "inv: <span>{0}</span><br />".format(passInvestigation),
            "Passive Investigation",
            tag = "div"),
        addTooltip(
            "ins: <span>{0}</span>".format(passInsight),
            "Passive Insight",
            tag = "div")
    ));
}

function updateMoney(parent, currencies, showSumOnly=false, updateTotalsTooltip=false, totalTooltipDefault=GP_TOTAL_TOOLTIP) {
    // console.log('updateMoney', 'parent:', parent, 'showSumOnly:', showSumOnly);

    // individual vals
    var ppc = $(".ppc", parent);
    var epc = $(".epc", parent);
    var gpc = $(".gpc", parent);
    var spc = $(".spc", parent);
    var cpc = $(".cpc", parent);

    var pp = $(".pp", ppc);
    var ep = $(".ep", epc);
    var gp = $(".gp", gpc);
    var sp = $(".sp", spc);
    var cp = $(".cp", cpc);

    updateCurrencyVis(ppc, pp, currencies.pp, showSumOnly);
    updateCurrencyVis(epc, ep, currencies.ep, showSumOnly);
    updateCurrencyVis(gpc, gp, currencies.gp, showSumOnly);
    updateCurrencyVis(spc, sp, currencies.sp, showSumOnly);
    updateCurrencyVis(cpc, cp, currencies.cp, showSumOnly);

    // total gp estimate
    var gpnum = currencies.gp;
    gpnum += currencies.pp * 10.0;
    gpnum += currencies.ep / 2.0;
    gpnum += currencies.sp / 10.0;
    gpnum += currencies.cp / 100.0;

    // always show at least something
    if (gpnum === 0) {
        gpc.removeClass(HIDE_CLASS);
    }

    gpnum_disp = getFormattedShortNum(gpnum);

    var total = $(".total", $(".col_money", parent));
    var hr = $("hr", $(".col_money", parent));

    if (showSumOnly) {
        hr.addClass(HIDE_CLASS);
        total.html("~<span>{0}</span> gp".format(gpnum_disp));
    } else {
        gp.removeClass(HIDE_CLASS);
        hr.removeClass(HIDE_CLASS);

        if (gpnum != currencies.gp) {
            gp.removeClass("gponly");
            hr.removeClass(HIDE_CLASS);

            var symbol = "≡"; // ⋍
            if (gpnum > 0 && gpnum % 1 != 0) {
                symbol = "~";
            }
            total.html("{1}<span>{0}</span> gp".format(gpnum_disp, symbol));
        } else {
            gp.addClass("gponly");
            hr.addClass(HIDE_CLASS);
            total.empty();
        }
    }

    if (updateTotalsTooltip) {
        genMoneyTooltip(total, currencies);
    } else {
        editTooltipLabel(total, totalTooltipDefault);
    }
}

function genMoneyTooltip(total, currencies) {
    var parent = $(`<span class="money"><span class="ppc"><span class="pp"></span> pp </span><span class="epc"><span class="ep"></span> ep </span><span class="gpc"><span class="gp"></span> gp </span><span class="spc"><span class="sp"></span> sp </span><span class="cpc"><span class="cp"></span> cp </span></span>`);

    var ppc = $(".ppc", parent);
    var epc = $(".epc", parent);
    var gpc = $(".gpc", parent);
    var spc = $(".spc", parent);
    var cpc = $(".cpc", parent);

    var pp = $(".pp", ppc);
    var ep = $(".ep", epc);
    var gp = $(".gp", gpc);
    var sp = $(".sp", spc);
    var cp = $(".cp", cpc);

    updateCurrencyVis(ppc, pp, currencies.pp, false, false);
    updateCurrencyVis(epc, ep, currencies.ep, false, false);
    updateCurrencyVis(gpc, gp, currencies.gp, false, false);
    updateCurrencyVis(spc, sp, currencies.sp, false, false);
    updateCurrencyVis(cpc, cp, currencies.cp, false, false);

    // console.log('money tooltip: ', parent, '\n', parent.prop('outerHTML'));
    editTooltipLabel(total, parent.prop('outerHTML'));
}

function updateCurrencyVis(c, cval, val, forceHide, shorten = true, hideClass = HIDE_CLASS) {
    // console.log('updateCurrencyVis forcehide:', forceHide);
    if (forceHide) {
        c.addClass(hideClass);
        return;
    }

    if (val > 0) { c.removeClass(hideClass); }
    else { c.addClass(hideClass); }

    short_num = getFormattedNum(val);
    if (shorten) {
        disp_num = getFormattedShortNum(val);
    } else {
        disp_num = short_num;
    }

    

    if (disp_num != short_num) {
        cval.html(short_num);
        var d = cval.parent().html();
        cval.html(addTooltip(disp_num, `<span class="money">{0}</span>`.format(d)));
    } else {
        cval.html(disp_num);
    }
}

function updateSkillProfs(parent, parent_secondrow, skills, customs) {
    const isHidden = "ishidden";
    const btnLightOutline = "btn-outline-light";
    const btnDarkOutline = "btn-outline-dark";
    const saveHalfName = "-arehalfprofshidden-";
    const saveCustName = "-arecustomprofshidden-";

    function skillSort(x, y) {
        if (x.name < y.name) return -1;
        if (x.name > y.name) return 1;
        return 0;
    }

    skills.sort(skillSort);
    customs.sort(skillSort);

    everything = [...genSkillsArray(skills), ...genSkillsArray(customs, isCustom=true)];
    
    var skillsnode = $(".col_skills", parent);
    skillsnode.empty();
    skillsnode.append(everything.join(" "));

    // copy to details row as well
    var skillsnode_details = $(".col_skills", parent_secondrow);
    skillsnode_details.html('<span class="{0}">Skills:</span> {1}'.format(ACTIVE_ROW_TITLE_CLASS, skillsnode.html()));

    // add 1/2 skill toggle
    var allHalf = $(".halfprof", skillsnode);
    if (allHalf.length > 0) {
        var rowid = parent.attr('id');

        var halfBtn = $(
            // TODO fix tooltip not showing at right position when using css float
            // addTooltip(
                `<a role='button' class='btn {0} halftoggle' href="#">½</a>`.format(btnLightOutline),
            //     "Toggle ½ Proficiency Display"
            // )
        );
        skillsnode.prepend(halfBtn);

        function toggleHidden() {
            allHalf.toggleClass(HIDE_CLASS);
            halfBtn.toggleClass(isHidden);

            halfBtn.toggleClass(btnLightOutline);
            halfBtn.toggleClass(btnDarkOutline);
        }
        
        // setup action
        halfBtn.click(() => {
            toggleHidden();
            _setGMValue(saveHalfName + rowid, halfBtn.hasClass(isHidden));
        });

        // read saved values if any
        var hideOnLoad = _getGMValueOrDefault(saveHalfName + rowid, false);
        if (hideOnLoad) {
            toggleHidden();
        }
    }

    // add custom skill toggle
    var allCustom = $(".custom", skillsnode);
    if (allCustom.length > 0) {
        var rowid = parent.attr('id');

        var custBtn = $(
            // TODO fix tooltip not showing at right position when using css float
            // addTooltip(
                `<a role='button' class='btn {0} customtoggle' href="#">✚</a>`.format(btnLightOutline), // ⚒ ⚔ ⛏
            //     "Toggle Custom Proficiency Display"
            // )
        );
        skillsnode.prepend(custBtn);

        function toggleHidden() {
            allCustom.toggleClass(HIDE_CLASS);
            custBtn.toggleClass(isHidden);

            custBtn.toggleClass(btnLightOutline);
            custBtn.toggleClass(btnDarkOutline);
        }
        
        // setup action
        custBtn.click(() => {
            toggleHidden();
            _setGMValue(saveCustName + rowid, custBtn.hasClass(isHidden));
        });

        // read saved values if any
        var hideOnLoad = _getGMValueOrDefault(saveCustName + rowid, false);
        if (hideOnLoad) {
            toggleHidden();
        }
    }
}

function genSkillsArray(skills, isCustom=false) {
    outarr = [];

    skills.forEach((item, idx) => {
        var name = item.name;
        var mod = Math.abs(item.modifier);
        var sign = getSign(item.modifier, forceZero = true);
        var color = '';
        var adv = '';
        var advText = '';

        if (item.modifier == 0) {
            color = 'normal';
        } else if (item.modifier > 0) {
            color = 'high';
        } else {
            color = 'low';
        }

        if (isCustom) {
            color += ' custom';
        }

        var hasAdv = item.advantageAdjustments.length > 0;
        var hasDisadv = item.disadvantageAdjustments.length > 0;
        if (hasAdv || hasDisadv) {
            if (hasAdv) {
                var a = [];
                item.advantageAdjustments.forEach((item, idx) => {
                    a.push(`<li><span class="adv">{0}</span>: {1}</li>`.format(item.type.toLowerCase(), item.restriction));
                });

                adv = GET_SVG_AS_ICON(SVG_ADVANTAGE);
                advText += "<ul>{0}</ul>".format(a.join(''));

                color += " advdisadv adv";
            }

            if (hasDisadv) {
                var a = [];
                item.disadvantageAdjustments.forEach((item, idx) => {
                    a.push(`<li><span class="disadv">{0}</span>: {1}</li>`.format(item.type.toLowerCase(), item.restriction));
                });

                adv = GET_SVG_AS_ICON(SVG_DISADVANTAGE);
                advText += "<ul>{0}</ul>".format(a.join(''));

                color += " advdisadv disadv";
            }
            
            if (hasAdv && hasDisadv) {
                adv = '';
            }
        }

        function getProfText(classtype, tooltipText, name, sign, mod, color, advIcon, advString, sup="") {
            // NOTE: we have to push the tooltip within the container for the skill, because the tooltip stuff uses
            // ::after same as our commas between skills at the moment :/ 

            var titleClass = "title";
            if (classType.length > 0) {
                if (classType == 'expert') titleClass += " gmcarm_highlight";
                if (classType == 'prof') titleClass += " gmcarm_normal";
                if (classType == 'halfprof') titleClass += " gmcarm_faded";
                if (classType == 'noprof') titleClass += " gmcarm_dark";
            }

            if (advString.length > 0) {
                tooltipText = `<span class="{1}">{0}</span>:<br />{2}`.format(tooltipText, titleClass, advString);
            } else {
                tooltipText = `<span class="{1}">{0}</span>`.format(tooltipText, titleClass);
            }
            
            return "<span class='c {0} {1}'>{2}</span>".format(
                classtype,
                color,
                addTooltip(
                    "{4}{0}<sup>{3}</sup> <span class='value'>{1}{2}</span>".format(
                        name,
                        sign,
                        mod,
                        sup,
                        advIcon
                    ),
                    tooltipText,
                    DEFAULT_TOOLTIP_TAG
                )
            );
        }

        var classType = '';
        var tipText = '';
        var supText = '';
        if (item.expertise) {
            classType = 'expert';
            tipText = "Expertise";
            supText = "🇪";
        } else if (item.proficiency) {
            classType = 'prof';
            tipText = "Proficiency";
            supText = "";
        } else if (item.halfProficiency) {
            classType = 'halfprof';
            tipText = "Half Proficiency";
            supText = "½";
        } else {
            classType = 'noprof';
            tipText = "Not Proficient";
            supText = "";
        }

        outarr.push(getProfText(classType, tipText, name, sign, mod, color, adv, advText, supText));
    });

    return outarr;
}

function updateLanguages(parent, profGroups, langs = [], updateHtml = true) {
    profGroups.forEach((item, idx) => {
        if (item.label == "Languages") {
            item.modifierGroups.forEach((lang, lidx) => {
                var l = "<span class='item' {1}>{0}</span>".format(
                    lang.label,
                    insertTooltipAttributes(
                        `<span class="title">language</span> via {0}`.format(lang.sources.join(', '))
                    )
                );

                if (!langs.includes(l)) {
                    langs.push(l);
                }
            });
        }
    });

    if (updateHtml) {
        langs.sort();
        var col_langs = $(".col_languages", parent);
        var span_langs = $(".langs", col_langs);
        span_langs.html(langs.join(", "));
    }

    return langs;
}

function updateDefenses(parent, character) {
    const col_langs = $(".col_languages", parent);
    const resset = $(".resset", col_langs);
    const immset = $(".immset", col_langs);
    const vulnset = $(".vulnset", col_langs);
    const saveset = $(".saveset", col_langs);
    const hr = $(".langshr", col_langs);

    const resNode = $(".resists", resset);
    const immNode = $(".immunities", immset);
    const vulnNode = $(".vulnerabilities", vulnset);
    const saveNode = $(".savemods", saveset);

    var res = [];
    var imm = [];
    var vuln = [];
    var save = [];

    // populate arrays
    character.resistances.forEach((item, idx) => {
        res.push("<span class='item_long' {1}>{2} {0}</span>".format(
            item.name,
            insertTooltipAttributes(`<span class="title adv">resistance</span> via {0}`.format(item.sources.join(', '))),
            GET_SVG_AS_ICON(SVG_RESISTANCE)
        ));
    });

    character.immunities.forEach((item, idx) => {
        imm.push("<span class='item_long' {1}>{2} {0}</span>".format(
            item.name,
            insertTooltipAttributes(`<span class="title adv">immunity</span> via {0}`.format(item.sources.join(', '))),
            GET_SVG_AS_ICON(SVG_IMMUNITY)
        ));
    });

    character.vulnerabilities.forEach((item, idx) => {
        vuln.push("<span class='item_long' {1}>{2} {0}</span>".format(
            item.name,
            insertTooltipAttributes(`<span class="title disadv">vulnerability</span> via {0}`.format(item.sources.join(', '))),
            GET_SVG_AS_ICON(SVG_VULNERABILITY)
        ));
    });

    character.savingThrowDiceAdjustments.forEach((item, idx) => {
        var icon = "";
        var advClass = "";
        if (item.type == "ADVANTAGE") {
            icon = GET_SVG_AS_ICON(SVG_ADVANTAGE);
            advClass = "adv";
        } else if (item.type == "DISADVANTAGE") {
            icon = GET_SVG_AS_ICON(SVG_DISADVANTAGE);
            advClass = "disadv";
        } else {
            icon = "<span class='type'>{0}</span>".format(item.type);
        }

        var stat = '';
        if (item.statId != null && Number.isFinite(item.statId)) {
            stat = "on <span class='code'>{0}</span> ".format(getStatScoreNameFromID(character.abilities, item.statId).toUpperCase());
        }

        var tooltipFormat = "";
        if (advClass.length > 0) {
            tooltipFormat = `<span class="{2}">{0}</span> via {1}`;
        } else {
            tooltipFormat = "{0}: {1}";
        }

        save.push(
            "<span class='item_long' {1}>{2} {3}{0}</span>".format(
                item.restriction,
                insertTooltipAttributes(tooltipFormat.format(
                    item.type.toLowerCase(),
                    item.dataOrigin.type,
                    advClass
                )),
                icon,
                stat
            )
        );
    });

    // set html
    _addSortedListToNode(res, resNode, sep=' ');
    _addSortedListToNode(imm, immNode, sep=' ');
    _addSortedListToNode(vuln, vulnNode, sep=' ');
    _addSortedListToNode(save, saveNode, sep=' ');

    // hide/show as appropriate
    var hideclass = 'inactiveset';
    _hideIfNoElements([...res, ...imm, ...vuln, ...save], hr, hideClass=hideclass);
    _hideIfNoElements(res, resset, hideClass=hideclass);
    _hideIfNoElements(imm, immset, hideClass=hideclass);
    _hideIfNoElements(vuln, vulnset, hideClass=hideclass);
    _hideIfNoElements(save, saveset, hideClass=hideclass);
}

function _hideIfNoElements(arr, node, hideClass = HIDE_CLASS) {
    if (arr.length == 0) { node.addClass(hideClass); } else { node.removeClass(hideClass); }
}

function _addSortedListToNode(arr, node, sep = ', ') {
    arr.sort();
    node.html(arr.join(sep));
}

function updateJump(parent_secondrow, character) {
    // math based on http://fexlabs.com/5ejump/
    var reach = null;
    var height = null;
    height = tryParseHeightToFeet(character.height);

    if (height === null) {
        height = 0;
    } else {
        reach = height * 1.5;
    }

    var str = getStatValue(STR_STAT, character.abilities);
    // var dex = getStatValue(DEX_STAT, character.abilities);
    var str_mod = getStatMod(STR_STAT, character.abilities);
    var dex_mod = getStatMod(DEX_STAT, character.abilities);;

    var lateLongMod = 0;
    var lateHighMod = 0;
    var runningLongMod = 0;
    var runningHighMod = 0;
    var globalMultiplier = 1;

    var minRunFeet = 10;

    // calc intermediate values based on char options and such
    if (isTigerTotemBarbarian(character)) {
        lateLongMod += 10;
        lateHighMod += 3;
    }

    if (isFighterChampionWithRemarkableAthelete(character)) {
        runningLongMod += str_mod;
    }

    if (false /* step of the wind */) {
        // TODO is there any way to detect if this is active?
        globalMultiplier *= 2;
    }

    if (false /* jump spell */) {
        // TODO is there any way to detect if this is active?
        globalMultiplier *= 3;
    }

    if (doesCharacterHaveItemWithDefinitionId(character, 4590 /* def id: Boots of Striding and Springing */)) {
        globalMultiplier *= 3;
    }

    if (doesCharacterHaveAthleteFeat(character)) {
        minRunFeet = 5;
    }

    if (isRogueThiefWithSecondStory(character)) {
        runningLongMod += dex_mod;
        runningHighMod += dex_mod;
    }

    // compute final values for display
    var obstacle = globalMultiplier * Math.floor(str * 2.5) / 10;

    var run_long = globalMultiplier * Math.floor(str * 1 + lateLongMod + runningLongMod);
    var run_high = globalMultiplier * (3 + str_mod + lateHighMod + runningHighMod);
    var run_grab = Math.floor((run_high + height * 1.5) * 10) / 10;

    var stand_long = globalMultiplier * Math.floor(str * 0.5 + lateLongMod);
    var stand_high = globalMultiplier * ((3 + str_mod) / 2 + lateHighMod);
    var stand_grab = Math.floor((stand_high + height * 1.5) * 10) / 10;

    // grab nodes and set data
    var nColJump = $(".col_jump", parent_secondrow);
    var nJumpStats = $(".jumpstats", nColJump);

    var nStand = $(".stand", nJumpStats);
    var nRun = $(".run", nJumpStats);
    var nObstacle = $(".obstacle", nJumpStats);
    var nReach = $(".reach", nJumpStats);

    var hasReach = reach !== null;

    // standing start values
    var nStandLong = $(".long > .body > .value > .num", nStand);
    var nStandHigh = $(".high > .body > .value > .num", nStand);
    var nStandGrabVal = $(".grab > .body > .value > .num", nStand);
    var nStandGrab = $(".grab", nStand);
    nStandLong.html(stand_long);
    nStandHigh.html(stand_high);
    if (hasReach) {
        nStandGrab.removeClass('hide');
        nStandGrabVal.html(stand_grab);
    } else {
        nStandGrab.addClass('hide');
    }

    // running start values
    var nRunMinMove = $(".title > .value > .num", nRun);
    var nRunLong = $(".long > .body > .value > .num", nRun);
    var nRunHigh = $(".high > .body > .value > .num", nRun);
    var nRunGrabVal = $(".grab > .body > .value > .num", nRun);
    var nRunGrab = $(".grab", nRun);
    nRunMinMove.html(minRunFeet);
    nRunLong.html(run_long);
    nRunHigh.html(run_high);
    if (hasReach) {
        nRunGrab.removeClass('hide');
        nRunGrabVal.html(run_grab);
    } else {
        nRunGrab.addClass('hide');
    }

    // obstacles
    var nObstacleMax = $(".body > .value > .num", nObstacle);
    nObstacleMax.html(obstacle);

    // reach
    var nReachBody = $(".body", nReach);
    if (hasReach) {
        nReachBody.html(
            `
                <span class="group">
                    <span class="title"><span class="value" title="Character height"><span class="num">{0}</span></span><span class="value" title="Height multiplier for reach while jumping"><span class="num">×1.5</span></span> =</span>
                    <span class="body"><span class="value" title="Reach on top of a jump"><span class="num">{1}</span><span class="units hide">ft</span></span></span>
                </span>
            `.format(
                character.height,
                Math.round(reach * 10) / 10
            ));
    } else {
        nReachBody.html(
            `
                <span class="group">
                    <span class="title"><span class="value" title="The multiplier to apply to the character height for reach on top of a jump"><span class="num">{0} ×1.5</span></span></span>
                </span>
            `.format(
                character.height !== null && character.height.length > 0
                    ? character.height
                    : "height"
            ));
    }
}

function isTigerTotemBarbarian(character) {
    var outVal = false;
    character.classes.forEach((c, idx) => {
        if (c.activeId != 27 /* barbarian id */) {
            return;
        }

        // we're a barb, but are we rocking the tiger totem spirit?
        c.activeClassFeatures.forEach((f, fidx) => {
            if (f.definition.id != 100 /* totem spirit id */) {
                return;
            }

            outVal = f.options.some(o => o.definition.id == 181 /* tiger spirit id */);
        });
    });

    return outVal;
}

function isFighterChampionWithRemarkableAthelete(character) {
    var outVal = false;
    character.classes.forEach((c, idx) => {
        if (c.activeId != 16 /* fighter id */) {
            return;
        }

        // does this fighter have remarkable athlete?
        outVal = c.activeClassFeatures.some(f => f.definition.id == 216 /* remarkable athlete id */);
    });

    return outVal;
}

function doesCharacterHaveItemWithDefinitionId(character, itemId) {
    return character.inventory.some(i => i.definition.id == itemId);
}

function doesCharacterHaveAthleteFeat(character) {
    return doesCharacterHaveFeatWithDefinitionId(character, 13 /* athlete id */);
}

function doesCharacterHaveFeatWithDefinitionId(character, defId) {
    return character.feats.some(f => f.definition.id == defId);
}

function isRogueThiefWithSecondStory(character) {
    var outVal = false;
    character.classes.forEach((c, idx) => {
        if (c.activeId != 23 /* rogue id */) {
            return;
        }

        // does this fighter have remarkable athlete?
        outVal = c.activeClassFeatures.some(f => f.definition.id == 365 /* second-story work id */);
    });

    return outVal;
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        D&DBeyond Module Loader
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function loadModules(modules) {
    /*
        A near direct copy of the function from http://media.dndbeyond.com/character-tools/characterTools.bundle.71970e5a4989d91edc1e.min.js
        This basically loads in the modules in https://media.dndbeyond.com/character-tools/vendors~characterTools.bundle.f8b53c07d1796f1d29cb.min.js and similar module based scripts
        these are stored in window.jsonpDDBCT and can be loaded by this script and interacted with by active modules
    */
    console.log("Loading modules");

    function webpackJsonpCallback(data) {
        /*
            This allows additonal modules to be added run, the input format needs to be at least a two dimentional array,
            e.g. [[2],[function (module, exports, __webpack_require__) {...},...]] or [2],{34: function (module, exports, __webpack_require__) {...},...}] if you want to have set module id's
            you can also run modules by adding a third element to the argument data, e.g. [4],{69: function (module, __webpack_exports__, __webpack_require__) {...},...}, [69,4]] which will run the module 69 in chunk 4
            I am not 100% on the logic of this, so feel free to expand on this and futher comment to help out!
        */
        var chunkIds = data[0];
        var moreModules = data[1];
        var executeModules = data[2];
        var moduleId,
            chunkId,
            i = 0,
            resolves = [];
        for (; i < chunkIds.length; i++) {
            chunkId = chunkIds[i];
            if (Object.prototype.hasOwnProperty.call(installedChunks, chunkId) && installedChunks[chunkId]) {
                resolves.push(installedChunks[chunkId][0])
            }
            installedChunks[chunkId] = 0
        }
        for (moduleId in moreModules) {
            if (Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
                modules[moduleId] = moreModules[moduleId]
            }
        }
        if (parentJsonpFunction) parentJsonpFunction(data);
        while (resolves.length) {
            resolves.shift()()
        }
        deferredModules.push.apply(deferredModules, executeModules || []);
        return checkDeferredModules()
    }

    function checkDeferredModules() {
        var result;
        for (var i = 0; i < deferredModules.length; i++) {
            var deferredModule = deferredModules[i];
            var fulfilled = true;
            for (var j = 1; j < deferredModule.length; j++) {
                var depId = deferredModule[j];
                if (installedChunks[depId] !== 0) fulfilled = false
            }
            if (fulfilled) {
                deferredModules.splice(i--, 1);
                result = __webpack_require__(__webpack_require__.s = deferredModule[0])
            }
        }
        return result
    }
    var installedModules = {};
    var installedChunks = {
        0: 0
    };
    var deferredModules = [];

    function __webpack_require__(moduleId) {
        if (installedModules[moduleId]) {
            return installedModules[moduleId].exports
        }
        var module = installedModules[moduleId] = {
            i: moduleId,
            l: false,
            exports: {}
        };
        modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
        module.l = true;
        return module.exports
    }
    __webpack_require__.m = modules;
    __webpack_require__.c = installedModules;
    __webpack_require__.d = function (exports, name, getter) {
        if (!__webpack_require__.o(exports, name)) {
            Object.defineProperty(exports, name, {
                enumerable: true,
                get: getter
            })
        }
    };
    __webpack_require__.r = function (exports) {
        if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
            Object.defineProperty(exports, Symbol.toStringTag, {
                value: "Module"
            })
        }
        Object.defineProperty(exports, "__esModule", {
            value: true
        })
    };
    __webpack_require__.t = function (value, mode) {
        if (mode & 1) value = __webpack_require__(value);
        if (mode & 8) return value;
        if (mode & 4 && typeof value === "object" && value && value.__esModule) return value;
        var ns = Object.create(null);
        __webpack_require__.r(ns);
        Object.defineProperty(ns, "default", {
            enumerable: true,
            value: value
        });
        if (mode & 2 && typeof value != "string") {
            for (var key in value) {
                __webpack_require__.d(ns, key, function (key) {
                    return value[key]
                }.bind(null, key));
            }
        }

        return ns
    };
    __webpack_require__.n = function (module) {
        var getter = module && module.__esModule ? function getDefault() {
                return module.default
            } :
            function getModuleExports() {
                return module
            };
        __webpack_require__.d(getter, "a", getter);
        return getter
    };
    __webpack_require__.o = function (object, property) {
        return Object.prototype.hasOwnProperty.call(object, property)
    };
    __webpack_require__.p = "";
    var jsonpArray = window.jsonpDDBCT = window.jsonpDDBCT || [];
    var oldJsonpFunction = jsonpArray.push.bind(jsonpArray); //This allows additonal modules to be added and run by using window.jsonpDDBCT.push(modules) which calls webpackJsonpCallback(modules) above
    jsonpArray.push2 = webpackJsonpCallback;
    jsonpArray = jsonpArray.slice();
    for (var i = 0; i < jsonpArray.length; i++) webpackJsonpCallback(jsonpArray[i]);
    var parentJsonpFunction = oldJsonpFunction;
    deferredModules.push([2080, 2]); //This sets module 2080 as an active module and is run after the other modules are loaded
    checkDeferredModules();
    console.log("Finished loading modules");
}


//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Generic Functions
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function isSuccessfulJSON(js, name) {
    let success = true;
    if (js.length < 1 || js.success == undefined) {
        console.warn("JSON " + name + " is malformed");
        return false;
    } else if (js.success == false) {
        console.warn("JSON " + name + "'s retrieval was unsuccessful");
        return false;
    } else if (js.success != true) {
        console.warn("JSON " + name + "'s retrieval was unsuccessful and is malformed");
        return false;
    } else if (js.data == undefined || js.data.length < 1) {
        console.warn("JSON " + name + "'s data is malformed");
        return false;
    }
    return true;
}

function loadStylesheet(href) {
    console.debug('Start: Adding CSS Stylesheet ' + href);
    var link = document.createElement('link');
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    document.head.appendChild(link);
    console.debug('Done: Adding CSS Stylesheet');
}

function getJSONfromURLs(urls, body, headers, cookies) {
    return new Promise(function (resolve, reject) {
        console.log("Fetching: ", urls);
        var proms = urls.map(d => fetchRequest(d, body, cookies));
        Promise.all(proms)
            .then(ps => Promise.all(ps.map(p => p.json()))) // p.json() also returns a promise
            .then(jsons => {
                console.log("JSON Data Retrived", urls);
                resolve(jsons);
            })
            .catch((error) => {
                reject(error);
            });
    });
}

function fetchRequest(url, body, headers, cookies) {
    let options = {};
    let myHeaders = new Headers({
        'X-Custom-Header': 'hello world',
    });
    for (let id in authHeaders) {
        myHeaders.append(id, authHeaders[id]);
    }
    if (body != undefined && body != '') {
        options.method = 'POST'
        myHeaders.append('Accept', 'application/json');
        myHeaders.append('Content-Type', 'application/json');
        options.body = JSON.stringify(body);
    }
    if (cookies != undefined && cookies != '') {
        options.cookies = cookies;
    }
    options.credentials = 'include';
    options.headers = myHeaders;
    console.log(options);
    return fetch(url, options);
}

function getSign(input, forceZero = false) {
    let number = parseIntSafe(input);
    if (number == 0) return forceZero ? positiveSign : "";
    return number >= 0 ? positiveSign : negativeSign
}

function roundDown(input) {
    let number = parseInt(input);
    if (isNaN(number)) {
        return NaN;
    }
    return Math.floor(input);
}

function roundUp(input) {
    let number = parseInt(input);
    if (isNaN(number)) {
        return NaN;
    }
    return Math.ceil(input);
}

function getFormattedNum(num, fractionDigits=0) {
    return num.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
}

function getFormattedShortNum(num) {
    // display as # of k's or m's for larger numbers
    gpnum_unit = "";
    gpnum_disp = roundDown(num);
    if (gpnum_disp >= 1000) {
        gpnum_disp /= 1000;
        gpnum_unit = "K";
    }

    if (gpnum_disp >= 1000) {
        gpnum_disp /= 1000;
        gpnum_unit = "M";
    }

    // decide if we want fractions...
    // if we have say like 10.9k, then the .9k is still relatively significant
    // but if we get up to say 90.9k, the .9k isn't much of anything anymore
    // so choosing an arbitrary cut-off of 50? *shrug* at that point, 0.9k => 0.9/50 => ~1.8%
    // seems good enough to be under 2% of the true value and save display space/clutter
    num_decimals = 0;
    if (gpnum_disp < 50) {
        num_decimals = 1;
    }

    gpnum_disp = "{0}{1}".format(getFormattedNum(gpnum_disp, num_decimals), gpnum_unit);

    return gpnum_disp;
}

function divide(numeratorInput, denominatorInput) {
    let numerator = parseInt(numeratorInput);
    let denominator = parseInt(denominatorInput);
    if (isNaN(numerator) || isNaN(denominator)) {
        return NaN;
    }
    return numerator / denominator;
}

function distanceUnit(input) {
    let number = parseIntSafe(input);
    let unit = 'ft.';
    if (number && number % FEET_IN_MILES === 0) {
        number = number / FEET_IN_MILES;
        unit = 'mile' + (Math.abs(number) === 1 ? '' : 's');
    }
    return unit;
}

function parseIntSafe(input) {
    let number = parseInt(input);
    if (isNaN(number)) {
        number = 0;
    }
    return number;
}

function parseBool(x) {
    return x ? true : false;
}

function addTooltip(inStr, tiptext, tag = DEFAULT_TOOLTIP_TAG) {
    // https://github.com/ghosh/microtip#usage
    return "<{1} {2}>{0}</{1}>".format(inStr, tag, insertTooltipAttributes(tiptext));
}

function insertTooltipAttributes(tiptext) {
    // title='{0}' removed to avoid double tooltip popups
    return "role='tooltip' title='{0}'".format(tiptext);
}

function updateTooltipText(toolNode, newToolText) {
    if (toolNode[0].hasAttribute("aria-label")) {
        toolNode.attr('aria-label', newToolText);
    }

    if (toolNode[0].hasAttribute("title")) {
        toolNode.attr('title', newToolText);
    }
}

function editTooltipLabel(node, newText) {
    // kinda hacky work-around to updating tooltips w/ tooltipstered afaik
    node.removeClass('tooltipstered');
    node.attr('title', newText);
    
    var bk = node.clone();
    var parent = node.parent();

    node.after(bk);
    node.remove();

    applyTooltips(parent);
}

function sortTable(table, order) {
    var asc = order === 'asc',
        tbody = table.find('tbody');

    tbody.find('tr').sort(function (a, b) {
        if (asc) {
            return $('td:first', a).text().localeCompare($('td:first', b).text());
        } else {
            return $('td:first', b).text().localeCompare($('td:first', a).text());
        }
    }).appendTo(tbody);
}

function _getCampaignPrefix() {
    return scriptVarPrefix + "-" + campaignID
}

function _getGMValueOrDefault(name, defaultVal) {
    return GM_getValue(_getCampaignPrefix() + name, GM_getValue(scriptVarPrefix + name, defaultVal));
}

function _setGMValue(name, val) {
    GM_setValue(_getCampaignPrefix() + name, val);
    GM_setValue(scriptVarPrefix + name, val);
}

function _genPlayerId(id) {
    return "player-" + id;
}

function _genSecondRowID(firstRowID) {
    return firstRowID + "_details";
}

function getStatScoreNameFromID(dataAbilities, id) {
    var stat = "UNKNOWN";

    dataAbilities.forEach((item, idx) => {
        if (item.id == id) {
            stat = item.name;
            return;
        }
    });
    
    return stat;
}

function isButtonToggleActive(btnNode) {
    return btnNode.hasClass('active');
}

function updateButtonToggleState(newState, btnNode) {
    if (newState) {
        btnNode.attr('data-bs-toggle', 'button');
        btnNode.attr('aria-pressed', 'true');
        btnNode.addClass('active');
    } else {
        btnNode.removeAttr('data-bs-toggle');
        btnNode.removeAttr('aria-pressed');
        btnNode.removeClass('active');
    }
}

function updateSiblingLabelToggleState(newState, btnNode) {
    return updateButtonToggleState(newState, btnNode.siblings("label.btn"));
}

function gset(cat, act, label = null, fields = null) {
    gse(cat, act, label, GV_TIME(), fields);
}
function gse(cat, act, label = null, val = null, fields = null) {
    var e = { 'gse': 'gse', 'event': cat, 'action': act, 'label': label, 'value': val, ...fields };
    unsafeWindow.dataLayer.push(e);
    // console.log('gse', e);
}

function tryParseHeightToFeet(hStr) {
    outHeight = null;

    // check if we're already just a number of some sort...
    outHeight = Number(hStr);
    if (isNum(hStr)) {
        // maybe we can do something smart here, but without knowing what the value 
        // actually means... gotta just get rid of it
        return null;
    }

    outHeight = __parseHeightVal(hStr);

    return outHeight;
}

/** 
 * Parse the string and if possible return final value in terms of number of feet 
 * 
 * Returns null if can't parse
 * */
function __parseHeightVal(hStr) {
    // console.log("\n\n__parseHeightVal :: input: ", hStr);

    // tokenize
    var tokens = hStr.split(regexNumberLetterBoundary);

    // console.log("__parseHeightVal :: ", "tokens: ", tokens);

    // we assume that things are laid out in some reasonable format, ex:
    // 1 [unit] 53 [other unit]
    // That is, the unit is to the right of the value

    var finalVal = 0;

    function cl1(t, v, n, a) {
        console.log("__parseHeightVal :: ", "\t\t units?", "add " + a + " as " + t + " [" + n + "]: ", v);
    }

    var i = 0;
    var wasFeet = false;
    while (true) {
        var t = tokens[i].trim();

        // console.log(
        //     "__parseHeightVal :: ",
        //     "\t loop head -- ",
        //     "final val: ", finalVal,
        //     "{0} / {1}".format(i, tokens.length),
        //     "t: ", t
        // );

        if (t.length == 0) {
            // console.log("__parseHeightVal :: ", "\t -> skip empty t");
            // empty, skip
            i++;
            continue;
        }

        if (isNum(t)) {
            t = Number(t);

            // console.log("__parseHeightVal :: ", "\t -> is num...", t);
            // we got a number, do we have units afterwards?
            var tNext = null;
            while (tNext === null) {
                // console.log(
                //     "__parseHeightVal :: ",
                //     "\t\t units?",
                //     "tNext", tNext,
                //     "wasFeet?", wasFeet,
                //     "{0} / {1}".format(i, tokens.length));
                
                if ((i + 1) >= tokens.length && !wasFeet) {
                    break;
                }

                if (wasFeet) {
                    // cl1("default[" + wasFeet + "]", finalVal, 0, t);
                    // if the previous units were in feet, we assume this next one is in inches
                    wasFeet = false;
                    finalVal += t / 12;

                    i++;
                    // cl1("default[" + wasFeet + "]", finalVal, 1, t);
                    continue;
                }

                var tNext = tokens[i + 1].trim().toLowerCase();
                if (!isNum(tNext)) {
                    switch (tNext) {
                        // metric
                        case 'km':
                            // cl1(tNext, finalVal, 0, t);
                            wasFeet = false;
                            finalVal += t * 0.03281 * 100000;
                            // cl1(tNext, finalVal, 1, t);
                            break;
                        case 'm':
                            // cl1(tNext, finalVal, 0, t);
                            wasFeet = false;
                            finalVal += t * 0.03281 * 100;
                            // cl1(tNext, finalVal, 1, t);
                            break;
                        case 'cm':
                            // cl1(tNext, finalVal, 0, t);
                            wasFeet = false;
                            finalVal += t * 0.03281;
                            // cl1(tNext, finalVal, 1, t);
                            break;
                        case 'mm':
                            // cl1(tNext, finalVal, 0, t);
                            wasFeet = false;
                            finalVal += t * 0.03281 / 10;
                            // cl1(tNext, finalVal, 1, t);
                            break;
                        
                        // imperial
                        case 'feet':
                        case 'ft':
                        case 'f':
                        case "'":
                        case '′':
                        case "`":
                            // cl1("feet[" + tNext + "]", finalVal, 0, t);
                            wasFeet = true;
                            finalVal += t;
                            // cl1("feet[" + tNext + "]", finalVal, 1, t);
                            break;
                        
                        case 'inches':
                        case 'inch':
                        case 'in':
                        case '"':
                        case "″":
                            // cl1("inch[" + tNext + "]", finalVal, 0, t);
                            wasFeet = false;
                            finalVal += t / 12;
                            // cl1("inch[" + tNext + "]", finalVal, 1, t);
                            break;
                    
                        default:
                            // cl1("default[" + wasFeet + "]", finalVal, 10, t);
                            if (wasFeet) {
                                // if the previous units were in feet, we assume this is in inches
                                wasFeet = false;
                                finalVal += t / 12;
                            } else {
                                // we've encountered an unknown unit type... abort
                                console.log("__parseHeightVal :: ", "unsupported units: ", tNext);
                                return null;
                            }
                            // cl1("default[" + wasFeet + "]", finalVal, 11, t);
                            break;
                    }

                    i++;
                    continue;
                } else {
                    // we got another number :/ get us outta this thing
                    console.log("__parseHeightVal :: ", "invalid double numbers, exit with null");
                    return null;
                }
            }
        }

        i++;
        if (i >= tokens.length) {
            break;
        }
    }

    // console.log("__parseHeightVal :: ", "final val: ", finalVal);

    return finalVal;
}

function isNum(str) {
    var n = Number(str);
    return !isNaN(n) && n !== null;
}

function anyValInString(array, str) {
    array.forEach(function (item, idx) {
        if (str.includes(item)) {
            return true;
        }
    });

    return false;
}

function getStatValue(stat, charAbilities) {
    var statid = abilityMap[stat];
    var outVal = 0;
    charAbilities.forEach(function (item, index) {
        if (item.id !== statid) {
            return;
        }

        outVal = item.totalScore;
    });

    return outVal;
}

function getStatMod(stat, charAbilities) {
    var statid = abilityMap[stat];
    var outVal = 0;
    charAbilities.forEach(function (item, index) {
        if (item.id !== statid) {
            return;
        }

        outVal = item.modifier;
    });

    return outVal;
}

function applyTooltips(parentNode) {
    var els = $('[title]', parentNode);
    els.tooltipster(toolTipsterSettings);
}

function genToggleButtonId(playerid, playername) {
    return "chartoggle__{0}".format(playerid);
}

function genToggleButton(playerid, playername) {
    var id = genToggleButtonId(playerid, playername);

    var playerfirstrow = _genPlayerId(playerid);
    var playersecondrow = _genSecondRowID(playerfirstrow);

    var displayName = playername;
    if (isCharacterPage()) {
        displayName = 'Stats';
    }

    var btn = $(`<a id='{0}' role='button' data-bs-toggle='button' class='btn btn-dark' href="#">{1}</a>`.format(id, displayName));

    var btnContainer = btn;
    if (isCharacterPage()) {
        btnContainer = $(`<div class="dice-toolbar__dropdown"><div class="dice-toolbar__dropdown-die"><span class='charhide'></span></div></div>`);
        var charhide = $(".charhide", btnContainer);

        charhide.append(btn);
    }

    var frNode = $("#" + playerfirstrow);
    var srNode = $("#" + playersecondrow);

    initSimpleStyleToggleButton(
        frNode,
        btnContainer,
        ROW_TOGGLE_CLASS,
        (isActive, $e) => {
            if (!isActive) {
                srNode.removeClass(ROW_TOGGLE_CLASS);

                btn.removeClass('btn-dark');
                btn.addClass('btn-light');
            } else {
                srNode.addClass(ROW_TOGGLE_CLASS);

                btn.removeClass('btn-light');
                btn.addClass('btn-dark');
            }

            if (isCharacterPage()) {
                if (!isActive) {
                    $("#gmstats").removeClass(NO_DISPLAY_CLASS);
                } else {
                    $("#gmstats").addClass(NO_DISPLAY_CLASS);
                }
            }
        });

    return btnContainer;
}

function updateToggleButtonName(playerid, playername) {
    var id = genToggleButtonId(playerid, playername);

    var displayName = playername;
    if (isCharacterPage()) {
        displayName = 'Stats';
    }

    $("#" + id).text(displayName);
}

function addOrUpdateToggleButton(playerid, playername) {
    var parent = toggleChars;
    if (isCharacterPage()) {
        parent = $("div.dice-toolbar");

        if (parent.length == 0) {
            // eh... hacky solution but don't feel like implementing all the stuff to sub to changes, we're just
            // gonna poll until the parent exists

            setTimeout(() => {
                addOrUpdateToggleButton(playerid, playername);
            }, 100);
            return;
        }
    }

    console.log('toggle parent:', parent);

    var toggleid = genToggleButtonId(playerid, playername);

    var existCheck = $("#" + toggleid, parent);
    if (existCheck.length == 0) {
        parent.append(genToggleButton(playerid, playername));
        parent.append("  ");
    } else {
        updateToggleButtonName(playerid, playername);
    }
}
