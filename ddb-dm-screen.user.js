// ==UserScript==
// @name            Carm DnD Beyond GM Screen
// @namespace       https://github.com/ootz0rz/DNDBeyond-DM-Screen/
// @version         1.1.5
// @description     GM screen for D&DBeyond campaigns
// @author          ootz0rz
// @match           https://www.dndbeyond.com/campaigns/*
// @exclude         /^https://www.dndbeyond.com/campaigns/.*?/.*?$/
// @updateURL       https://github.com/ootz0rz/DNDBeyond-DM-Screen/raw/master/ddb-dm-screen.user.js
// @require         https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @require         https://media.dndbeyond.com/character-tools/vendors~characterTools.bundle.dec3c041829e401e5940.min.js
// @require         https://www.googletagmanager.com/gtag/js?id=G-XDQBBDCJJV
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

const rulesUrls = ["https://character-service.dndbeyond.com/character/v4/rule-data", "https://gamedata-service.dndbeyond.com/vehicles/v3/rule-data"];
const charJSONurlBase = "https://character-service.dndbeyond.com/character/v4/character/";

const stylesheetUrls = [
    "https://raw.githack.com/ootz0rz/DNDBeyond-DM-Screen/master/dm-screen.css"
]

const gameCollectionUrl = {prefix :"https://character-service.dndbeyond.com/character/v4/game-data/", postfix: "/collection"}
const optionalRules = {
    "optionalOrigins": {category:"racial-trait", id:"racialTraitId" },
    "optionalClassFeatures": {category:"class-feature", id:"classFeatureId" },
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

const HIDE_CLASS = 'hide';
const ACTIVE_ROW_CLASS = 'active_row';
const ACTIVE_ROW_VAR_NAME_PREFIX = '-active_row-';
const DEFAULT_TOOLTIP_PLACEMENT = 'top';
const ACTIVE_FIRST_ROW_CLASS = 'first_row';
const ACTIVE_SECOND_ROW_CLASS = 'second_row';
const ACTIVE_ROW_TITLE_CLASS = 'activetitle';

var $ = window.jQuery;
var rulesData = {},
    charactersData = {},
    campaignID = 0,
    campaignNode = {},
    authHeaders = {},
    editableChars = {};
var mainTable = null;
var colStatsSubTable = null;

// refresh timer
// config
var tockDuration = 1; // in seconds

// state
var refresh_timeSinceLastRefresh = 0;
var refresh_currentTimer = null;
var refresh_autoUpdateNode = null;
var refresh_isTimerActive = false;
var refresh_progressBarContents = null;
var refresh_progressBarCurr = null;
var refresh_progressBarTotal = null;
var refresh_progressBarPct = null;
var refresh_isForceRefresh = false;

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
var my_css = "";
/*
// @resource        IMPORTED_CSS file:///C:/Users/ootz0/Workspace/git/DNDBeyond-DM-Screen/dm-screen.css
// @grant           GM_getResourceText
// @grant           GM_addStyle
*/
if (typeof GM_getResourceText === 'function') {
    my_css = GM_getResourceText("IMPORTED_CSS");
}

// load style sheets
if (my_css.length > 0) {
    GM_addStyle(my_css);
} else {
    stylesheetUrls.forEach(loadStylesheet);
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        SVGs
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const SVG_CLASS_ICON = `deficon`;
const SVG_CLASS_ICON_WHITE = SVG_CLASS_ICON + ` white`;

function GET_SVG_AS_ICON(icon, color = SVG_CLASS_ICON) {
    return icon.format(` class="{0}"`.format(color));
}

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
                <span role="tooltip" data-microtip-position="right" aria-label="Armor Class">AC</span>
                <hr />
                <div class="init" role="tooltip" data-microtip-position="right" aria-label="Initiative">Init</div>
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
                <div role="tooltip" data-microtip-position="right" aria-label="Passive Perception"><span>per</span>cept</div>
                <div role="tooltip" data-microtip-position="right" aria-label="Passive Investigation"><span>inv</span>est</div>
                <div role="tooltip" data-microtip-position="right" aria-label="Passive Insight"><span>ins</span>ight</div>
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
            <td class="col_name">
                Totals:
            </td>
            <td class="col_hp"></td>
            <td class="col_ac"></td>
            <td class="col_speed"></td>
            <td class="col_stat b_left"></td>
            <td class="col_stat"></td>
            <td class="col_stat"></td>
            <td class="col_stat"></td>
            <td class="col_stat"></td>
            <td class="col_stat"></td>
            <td class="col_stat b_right"></td>
            <td class="col_money" colspan="2">
                <span class="total" role="tooltip" data-microtip-position="{0}" aria-label="Approx Total in GP"></span><hr />
                <span class="ppc"><span class="pp"></span> pp</span>
                <span class="epc"><span class="ep"></span> ep </span>
                <span class="gpc"><span class="gp"></span> gp </span>
                <span class="spc"><span class="sp"></span> sp </span>
                <span class="cpc"><span class="cp"></span> cp </span>
            </td>
            <td class="col_languages" colspan="2"></td>
        </tr>
        <tr>
            <td colspan="15" class='gs-controls'>
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
                            <label for="gs-auto-duration">Duration (sec):</label>
                            <input class="form-control auto_duration" type="number" name="gs-auto-duration" id="gs-auto-duration" value="60" placeholder="secs">
                        </span>
                    </span>
                    <span class="gs-form-field gs-row-container set">
                        <input class="btn-check" type="checkbox" name="gs-auto-update" id="gs-auto-update" value="false">
                        <label class="btn btn-outline-warning" for="gs-auto-update">Auto Update</label>
                        <a id="force_refresh" role='button' class='btn btn-outline-info' href="#">Force Refresh</a>
                    </span>
                </span>
            </td>
        </tr>
        <tr>
            <td colspan="15" class="gs-controls gs-bottom">
                <span class='update'><a role='button' class='btn btn-outline-info' target="_blank" href="https://github.com/ootz0rz/DNDBeyond-DM-Screen/raw/master/ddb-dm-screen.user.js">check for gm screen extension update</a></span>
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
    </tfoot>
</table>
`.format(DEFAULT_TOOLTIP_PLACEMENT);

var tableRowHTML = `
        <tr>
            <td class="col_name">
                <span class="name" role="tooltip" data-microtip-position="right" aria-label="Toggle Detail View"></span><span class="inspiration hide" role="tooltip" data-microtip-position="{0}" aria-label="Inspiration">🎲</span>
                <span class="links"><span role="tooltip" data-microtip-position="{0}" aria-label="Edit"><a href="#" class="edit hide"></a></span><span role="tooltip" data-microtip-position="{0}" aria-label="View"><a href="#" class="view hide"></a></span></span><br/>
                <div class="exhaust"><span></span>- - - - - -</div>
                <div class="spellsavedc"><span></span></div>
                <div class="classes"></div>
                <div class="profbonus"><hr /><span class="pb" role="tooltip" data-microtip-position="right" aria-label="Proficiency Bonus">PB: <span class="pbval">+2</span></span></div>
            </td>
            <td class="col_hp">
                <span class="hurt"></span>
            </td>
            <td class="col_ac">
                <span class="acval" role="tooltip" data-microtip-position="{0}" aria-label="Armor Class"></span>
                <hr />
                <span class="initval" role="tooltip" data-microtip-position="{0}" aria-label="Initiative"></span>
            </td>
            <td class="col_speed"></td>
            <td class="col_stat col_titles b_left">
                <div class="stat_title">&nbsp;</div>
                <span role="tooltip" data-microtip-position="{0}" aria-label="Ability Score">A</span><br/>
                <span role="tooltip" data-microtip-position="{0}" aria-label="Bonus">B</span><br/>
                <span role="tooltip" data-microtip-position="{0}" aria-label="Save">S</span></td>
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
                <span class="total" role="tooltip" data-microtip-position="{0}" aria-label="Approx Total in GP"></span><hr />
                <span class="ppc"><span class="pp"></span> pp</span>
                <span class="epc"><span class="ep"></span> ep </span>
                <span class="gpc"><span class="gp"></span> gp </span>
                <span class="spc"><span class="sp"></span> sp </span>
                <span class="cpc"><span class="cp"></span> cp </span>
            </td>
            <td class="col_skills"></td>
            <td class="col_languages">
                <div class="langset">
                    <span class="activetitle langstitle" role="tooltip" data-microtip-position="{0}" aria-label="Languages">Langs:</span>
                    <span class="langs"></span>
                </div>
                <hr class="langshr" />
                <div class="resset">
                    <span class="activetitle resstitle" role="tooltip" data-microtip-position="{0}" aria-label="Resistances"><svg class='deficon' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.89941 48" class="ddbc-svg  ddbc-resistance-icon"><path fill="#2C9400" d="M21.18969,15.5h-4.12v7.44h4.12a3.68142,3.68142,0,0,0,2.79-.97,3.75732,3.75732,0,0,0,.94-2.73,3.81933,3.81933,0,0,0-.95-2.74A3.638,3.638,0,0,0,21.18969,15.5Z"></path><path fill="#2C9400" d="M40.4497,8c-11,0-20-6-20-8,0,2-9,8-20,8-4,35,20,40,20,40S44.4497,43,40.4497,8Zm-8.11,29.51h-6.97l-4.77-9.56h-3.53v9.56h-6.51V10.49h10.63c3.2,0,5.71.71,7.51,2.13a7.21618,7.21618,0,0,1,2.71,6.03,8.78153,8.78153,0,0,1-1.14,4.67005,8.14932,8.14932,0,0,1-3.57,3l5.64,10.91Z"></path></svg></span>
                    <span class="resists"></span>
                </div>
                <div class="immset">
                    <span class="activetitle immsstitle" role="tooltip" data-microtip-position="{0}" aria-label="Immunities"><svg class='deficon' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.89941 48" class="ddbc-svg  ddbc-immunity-icon"><path fill="#2C9400" d="M40.4497,8c-11,0-20-6-20-8,0,2-9,8-20,8-4,35,20,40,20,40S44.4497,43,40.4497,8Zm-16.75,29.42h-6.5V10.4h6.5Z"></path></svg></span>
                    <span class="immunities"></span>
                </div>
                <div class="vulnset">
                    <span class="activetitle vulnsstitle" role="tooltip" data-microtip-position="{0}" aria-label="Vulnerabilities"><svg class='deficon' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40.89941 48" class="ddbc-svg  ddbc-vulnerability-icon"><path fill="#b00000" d="M40.4497,8c-11,0-20-6-20-8,0,2-9,8-20,8-4,35,20,40,20,40S44.4497,43,40.4497,8Zm-16.63,30.42h-7.12l-9.02-27.02h7.22L20.2597,31.07l5.38-19.67h7.27Z"></path></svg></span>
                    <span class="vulnerabilities"></span>
                </div>
                <div class="saveset">
                    <span class="activetitle savesstitle" role="tooltip" data-microtip-position="{0}" aria-label="Save Modifiers">Saves:</span>
                    <br />
                    <span class="savemods"></span>
                </div>
            </td>
        </tr>
`.format(DEFAULT_TOOLTIP_PLACEMENT);

var tableSecondRowHTML = `
        <tr id="_details" class="active_row second_row">
            <td class='col_details' colspan="14">
                <table class="table detailstable font_normal secondary">
                    <tbody>
                        <tr>
                            <td class='col_skills' colspan="2"></td>
                        </tr>
                    </tbody>
                </table>
            </td>
        </tr>
`.format(DEFAULT_TOOLTIP_PLACEMENT);

var a = $("<script>", { type: 'text/javascript', src: 'https://www.googletagmanager.com/gtag/js?id=G-XDQBBDCJJV' });
a[0].setAttribute("async", "");
$("body").append(a);

var a2 = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-XDQBBDCJJV');`;
var script = document.createElement('script');
script.innerHTML = a2;
document.body.appendChild(script);

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
    insertElements();
    insertCampaignElements();

    updateAllCharData();

    initRefreshTimer();
})();

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Functions
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------



function findTargets() {
    console.log("Locating Characters from Window");
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
            }

            for (let ruleID in optionalRules) {
                charactersData[charID].state.serviceData.definitionPool[optionalRules[ruleID].category] = {
                    accessTypeLookup: {},
                    definitionLookup: {},
                };
            }
        } else {
            console.warn("warn: skipping " + value.href + " due to ID not found");
        }
    });
    console.log("Finished locating Characters from Window");
    //console.debug(charactersData);
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

    var sitemain = $("#site-main");
    var node = $("<div id='gmstats'></div>");

    sitemain.prepend(node);

    node.append(mainTableHTML);

    mainTable = $("table.primary", node);
    colStatsSubTable = $("table.stattable")

    var tableBody = $("#gm_table_body", node);

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
    $('td.col_name .name', tableBody).click(function () {
        var node = $(this);
        var row = node.parent().parent();

        // toggle right away on click to check active status for everything else
        row.toggleClass(ACTIVE_ROW_CLASS);

        var playerid = row.attr('id');
        var isActive = row.hasClass(ACTIVE_ROW_CLASS);

        // save right away on click
        _setGMValue(ACTIVE_ROW_VAR_NAME_PREFIX + playerid, isActive);

        updateRowIfShouldBeActive(row);
    });

    // force data refresh on click
    $("#force_refresh", node).click(function () {
        console.log("Force Refresh...");
        refreshTimer_startForceRefresh();
    });
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
        }).catch((error) => {
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
            updateCampaignData();
            refreshTimer__checkShouldStart(refresh_autoUpdateNode);
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
                        console.log("Retrived Char Data for char " + charId + " aka " + charactersData[charId].data.name);
                        console.log(charactersData[charId]);
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

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Refresh timer
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function initRefreshTimer() {
    console.log('[0] init refresh timer');

    var controls = $(".gs-controls");

    refresh_autoUpdateNode = $('input[name ="gs-auto-update"]', controls);
    minTimeNode = $('input[name ="gs-auto-duration"]', controls);

    var pbar = $(".progress-wrapper", controls);
    refresh_progressBarContents = $(".progress-bar-fill", pbar);
    refresh_progressBarCurr = $(".curr", pbar);
    refresh_progressBarTotal = $(".total", pbar);
    refresh_progressBarPct = $(".pct", pbar);

    console.log('[1] init refresh timer',
        '\ninputs', autoUpdateNode, minTimeNode,
        '\npbar contents', refresh_progressBarContents,
        '\npbar curr/total', refresh_progressBarCurr, refresh_progressBarTotal
    );

    refreshTimer__checkShouldStart(refresh_autoUpdateNode);
}

function refreshTimer__checkShouldStart(node) {
    var $node = $(node);
    let val = parseBool($node.prop("checked"));

    // console.log('refreshTimer__checkShouldStart', $node, val);

    refreshTimer_endForceRefresh($node, val);

    if (val) {
        refreshTimer_start();
    } else {
        refreshTimer_end();
    }
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

    updateAllCharData();
}

function refreshTimer_tockNext() {
    refreshTimer_updatePbar();
    refresh_currentTimer = setTimeout(refreshTimer_tock, tockDuration * 1000);
}

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

    refreshTimer_setPbar(100, 0, 0);
    $("#force_refresh").attr('disabled', 'disabled');
}

function refreshTimer_endForceRefresh($node, isAutoRefreshActive) {
    if (refresh_isForceRefresh) {
        refresh_isForceRefresh = false;
        $("#force_refresh").removeAttr('disabled', 'disabled');

        if (!isAutoRefreshActive) {
            refreshTimer_setPbar(0, 0, 0);
        }
    }
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

    autoUpdate.change(function () {
        var $this = $(this);
        let val = parseBool($this.prop("checked"));
        
        _setGMValue("-autoUpdate", val);

        refreshTimer__checkShouldStart($this);
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
    fontSize.change(function () {
        let val = parseIntSafe($(this).val());
        _setGMValue("-fontSize", val);

        onFontSizeChange(mainTable, val);
        onFontSizeChange(colStatsSubTable, val);
        onFontSizeChange($("table.secondary", mainTable), val);
    });

    displayDeactive.change(function () {
        let val = parseBool($(this).prop("checked"));
        _setGMValue("-displaydeactive", val);

        onDisplayTypeChange('deactivated', val);
    });
    displayUnassigned.change(function () {
        let val = parseBool($(this).prop("checked"));
        _setGMValue("-displayunassigned", val);

        onDisplayTypeChange('unassigned', val);
    });
}

function onFontSizeChange(table, updatedFontSize) {
    for (const idx in fontSizeMap) {
        if (table.hasClass(fontSizeMap[idx])) {
            table.removeClass(fontSizeMap[idx]);
        }
    }

    var newFontClass = fontSizeMap[updatedFontSize];
    table.addClass(newFontClass);
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

            var isLastChar = idx == len - 1;
            if (isLastChar) {
                updateMoney(totalsRow, globalCurrencies, showSumOnly=true);
            }

            // languages
            updateLanguages(
                totalsRow,
                charData.proficiencyGroups,
                globalLanguages,
                updateHtml = isLastChar);
        }

        idx++;
    }
}


function updateElementData(allCharData, charId) {
    const character = allCharData.data;
    const parent = allCharData.node;
    const parent_secondrow = allCharData.node_details;

    console.log('update info: ', charId, character);

    updateRowIfShouldBeActive(parent);

    updateNameBlock(parent, allCharData, character);
    updateHitPointInfo(parent, character.hitPointInfo, character.deathSaveInfo);
    updateArmorClass(parent, character.armorClass, character.initiative);
    updateSpeeds(parent, character);

    updateAbilties(parent, character.abilities);
    updatePassives(parent, character.passivePerception, character.passiveInvestigation, character.passiveInsight);
    updateMoney(parent, character.currencies);
    updateSkillProfs(parent, parent_secondrow, character.skills, character.customSkills);
    updateLanguages(parent, character.proficiencyGroups);
    updateDefenses(parent, character);
}

function updateRowIfShouldBeActive(primaryRow) {
    var playerId = primaryRow.attr('id');
    var secondrow = $('#{0}'.format(_genSecondRowID(playerId)), primaryRow.parent());

    var col_name = $('td.col_name', primaryRow);
    var col_skills = $('td.col_skills', primaryRow);
    var col_langs = $('td.col_languages', primaryRow);

    var col_langs_title = $("." + ACTIVE_ROW_TITLE_CLASS, col_langs);
    var col_langs_hr = $(".langshr", col_langs);
    var col_langs_resset = $(".resset", col_langs);
    var col_langs_immset = $(".immset", col_langs);
    var col_langs_vulnset = $(".vulnset", col_langs);
    var col_langs_saveset = $(".saveset", col_langs);
    
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

function updateNameBlockExhaust(character, nameblock) {
    const maxExhaust = 6;

    var conditions = character.conditions;
    var isExhausted = false;
    var exhaustLevel = 0;

    conditions.forEach((item, idx) => {
        if (item.definition.slug == 'exhaustion') {
            isExhausted = true;
            exhaustLevel = item.level;
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

        exhaustBlock.removeClass(HIDE_CLASS);
        exhaustBlock.html("<span>{0}</span>{1}".format(exhaustStr, restStr));
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

    var color = 'normal';
    if (pct_left < 50) color = 'bad';
    else if (pct_left < 75) color = 'hurt';
    else if (pct_left < 100) color = 'good';
    else if (pct_left > 100) color = 'overheal';
    else color = 'normal';

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

    // put it all together

    hp.html(
        `<span class="{0}">{1}</span>{2}{3}{4}`
        .format(
            color,
            "{0}/{1} {2}%".format(remaining, max, Math.round(pct_left)),
            bonus_str,
            temp_str,
            dsstr
        )
    );
}

function updateArmorClass(parent, armorClass, init) {
    var node = parent.find('td.col_ac');
    $(".acval", node).html(armorClass);
    $(".initval", node).html("{0}{1}".format(getSign(init), Math.abs(init)));
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
        cell.append("<span class='high' {1}>{0}</span><br />".format(item.totalScore));//, insertTooltipAttributes(abilityKey + ' score')));

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
        else if (mod > 0) { color = "high"; }
        else if (mod < 0) { color = "low"; }

        if (!isprof || mod == save) {
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
            "perception",
            tag = "div"),
        addTooltip(
            "inv: <span>{0}</span><br />".format(passInvestigation),
            "investigation",
            tag = "div"),
        addTooltip(
            "ins: <span>{0}</span>".format(passInsight),
            "insight",
            tag = "div")
    ));
}

function updateMoney(parent, currencies, showSumOnly=false) {
    console.log('updateMoney', 'parent:', parent, 'showSumOnly:', showSumOnly);
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

    var total = $(".total", $(".col_money", parent));
    var hr = $("hr", $(".col_money", parent));

    if (showSumOnly) {
        hr.addClass(HIDE_CLASS);
        total.html("~<span>{0}</span> gp".format(roundDown(gpnum)));
    } else {
        gp.removeClass(HIDE_CLASS);
        hr.removeClass(HIDE_CLASS);

        if (gpnum > 0 && gpnum % 1 != 0) {
            gp.removeClass("gponly");
            hr.removeClass(HIDE_CLASS);
            total.html("~<span>{0}</span> gp".format(roundDown(gpnum)));
        } else {
            gp.addClass("gponly");
            hr.addClass(HIDE_CLASS);
            total.empty();
        }
    } 
}

function updateCurrencyVis(c, cval, val, forceHide, hideClass = HIDE_CLASS) {
    console.log('updateCurrencyVis forcehide:', forceHide);
    if (forceHide) {
        c.addClass(hideClass);
        return;
    }

    if (val > 0) { c.removeClass(hideClass); }
    else { c.addClass(hideClass); }
    cval.html(val);
}

function updateSkillProfs(parent, parent_secondrow, skills, customs) {
    const isHidden = "ishidden";
    const saveName = "-arehalfprofshidden-";

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
                `<a role='button' class='btn btn-outline-light halftoggle' href="#">½</a>`,
            //     "Toggle ½ Proficiency Display"
            // )
        );
        skillsnode.prepend(halfBtn);

        function toggleHidden() {
            allHalf.toggleClass(HIDE_CLASS);
            halfBtn.toggleClass(isHidden);
        }
        
        // setup action
        halfBtn.click(() => {
            toggleHidden();
            _setGMValue(saveName + rowid, halfBtn.hasClass(isHidden));
        });

        // read saved values if any
        var hideOnLoad = _getGMValueOrDefault(saveName + rowid, false);
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
                    a.push("{0}: {1}".format(item.type.toLowerCase(), item.restriction));
                });

                adv = GET_SVG_AS_ICON(SVG_ADVANTAGE);
                advText += a.join(', ');

                color += " advdisadv adv";
            }

            if (hasDisadv) {
                var a = [];
                item.disadvantageAdjustments.forEach((item, idx) => {
                    a.push("{0}: {1}".format(item.type.toLowerCase(), item.restriction));
                });

                adv = GET_SVG_AS_ICON(SVG_DISADVANTAGE);
                advText += a.join(', ');

                color += " advdisadv disadv";
            }
            
            if (hasAdv && hasDisadv) {
                adv = '';
            }
        }

        function getProfText(classtype, tooltipText, name, sign, mod, color, advIcon, advString, sup="") {
            // NOTE: we have to push the tooltip within the container for the skill, because the tooltip stuff uses
            // ::after same as our commas between skills at the moment :/ 

            if (advString.length > 0) {
                tooltipText += " | " + advString;
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
                    tooltipText
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
            tipText = "½ Proficiency";
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
                var l = "<span class='item' {1}>{0}</span>".format(lang.label, insertTooltipAttributes(lang.sources.join(', ')));

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
        res.push("<span class='item_long' {1}>{0}</span>".format(item.name, insertTooltipAttributes(item.sources.join(', '))));
    });

    character.immunities.forEach((item, idx) => {
        imm.push("<span class='item_long' {1}>{0}</span>".format(item.name, insertTooltipAttributes(item.sources.join(', '))));
    });

    character.vulnerabilities.forEach((item, idx) => {
        vuln.push("<span class='item_long' {1}>{0}</span>".format(item.name, insertTooltipAttributes(item.sources.join(', '))));
    });

    character.savingThrowDiceAdjustments.forEach((item, idx) => {
        var icon = "";
        if (item.type == "ADVANTAGE") {
            icon = GET_SVG_AS_ICON(SVG_ADVANTAGE);
        } else if (item.type == "DISADVANTAGE") {
            icon = GET_SVG_AS_ICON(SVG_DISADVANTAGE);
        } else {
            icon = "<span class='type'>{0}</span>".format(item.type);
        }

        var stat = '';
        if (item.statId != null && Number.isFinite(item.statId)) {
            stat = "on {0} ".format(getStatScoreNameFromID(character.abilities, item.statId).toUpperCase());
        }

        save.push(
            "<span class='item_long' {1}>{2} {3}{0}</span>".format(
                item.restriction,
                insertTooltipAttributes(
                    "{0}: {1}".format(item.type.toLowerCase(), item.dataOrigin.type)
                ),
                icon,
                stat
            )
        );
    });

    // set html
    _addSortedListToNode(res, resNode);
    _addSortedListToNode(imm, immNode);
    _addSortedListToNode(vuln, vulnNode);
    _addSortedListToNode(save, saveNode, sep='<br />');

    // hide/show as appropriate
    var hideclass = 'inactiveset';
    _hideIfNoElements([...res, ...imm, ...vuln], hr, hideClass=hideclass);
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
                console.log("JSON Data Retrived");
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

function addTooltip(inStr, tiptext, tag = "span", placement = DEFAULT_TOOLTIP_PLACEMENT) {
    // https://github.com/ghosh/microtip#usage
    return "<{1} {2}>{0}</{1}>".format(inStr, tag, insertTooltipAttributes(tiptext, placement));
}

function insertTooltipAttributes(tiptext, placement = DEFAULT_TOOLTIP_PLACEMENT) {
    // title='{0}' removed to avoid double tooltip popups
    return "role='tooltip' data-microtip-position='{1}' aria-label='{0}'".format(tiptext, placement);
}

function editTooltipLabel(node, newText) {
    node.attr('aria-label', newText);
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