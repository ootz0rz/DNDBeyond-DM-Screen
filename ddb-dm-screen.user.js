// ==UserScript==
// @name			ootz D&DBeyond DM Screen
// @namespace		https://github.com/ootz0rz/DNDBeyond-DM-Screen/
// @version			1.0
// @description		Advanced DM screen for D&DBeyond campaigns
// @author			ootz0rz
// @match			https://www.dndbeyond.com/campaigns/*
// @updateURL		https://github.com/ootz0rz/DNDBeyond-DM-Screen/raw/master/ddb-dm-screen.user.js
// @require			https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @require         https://media.dndbeyond.com/character-tools/vendors~characterTools.bundle.dec3c041829e401e5940.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js
// @grant			GM_setValue
// @grant			GM_getValue
// @license			MIT; https://github.com/ootz0rz/DNDBeyond-DM-Screen/blob/master/LICENSE
// @resource        IMPORTED_CSS file:///C:/Users/ootz0/Workspace/git/DNDBeyond-DM-Screen/dm-screen.css
// @grant           GM_getResourceText
// @grant           GM_addStyle
// ==/UserScript==
console.log("D&DBeyond DM Screen Starting");

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Script Globals
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const linkUrlTarget = '.ddb-campaigns-character-card-footer-links-item-view';
const campaignElementTarget = '.ddb-campaigns-detail-header-secondary';

const rulesUrls = ["https://character-service.dndbeyond.com/character/v4/rule-data", "https://gamedata-service.dndbeyond.com/vehicles/v3/rule-data"];
const charJSONurlBase = "https://character-service.dndbeyond.com/character/v4/character/";

const stylesheetUrls = [
    "https://raw.githubusercontent.com/ootz0rz/DNDBeyond-DM-Screen/master/dm-screen.css",
    "https://raw.githack.com/ootz0rz/DNDBeyond-DM-Screen/master/dm-screen.css", // TODO temp for dev
]

const gameCollectionUrl = {prefix :"https://character-service.dndbeyond.com/character/v4/game-data/", postfix: "/collection"}
const optionalRules = {
    "optionalOrigins": {category:"racial-trait", id:"racialTraitId" },
    "optionalClassFeatures": {category:"class-feature", id:"classFeatureId" },
};

const senseToName = {
    'blindsight': 'bs',
    'darkvision': 'dv',
    'tremorsense': 'ts',
    'truesight': 'true',
    'passive-perception': 'pass-perc',
}

const scriptVarPrefix = "DMScreen-";

const charIDRegex = /\/(\d+)\/*$/;
const campaignIDRegex = /\/(\d+)\/*$/;

const FEET_IN_MILES = 5280;
const POUNDS_IN_TON = 2000;
const positiveSign = '+', negativeSign = '-';

const autoUpdateDefault = true;
const updateDurationDefault = 60;

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

var $ = window.jQuery;
var rulesData = {}, charactersData = {}, campaignID = 0, campaignNode = {}, authHeaders ={};

// string format check
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    };
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        HTML Structures
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

//base html for the controls
var controlsHTML = `
    <div id="gs-campaign" class="gs-campaign gs-box-grey gs-box-bluetop">
	  <div class="gs-title gs-header-campaign">Campaign</div>
      <div class="gs-container gs-col-container">
	    <div class="gs-campaign-row1 gs-container gs-row-container">
          <div class="gs-controls gs-container gs-col-container">
	        <div class="gs-header gs-header-controls">Controls</div>
	        <div class="gs-container gs-row-container">
	  	      <div class="gs-auto-update-controls gs-container gs-col-container">
                <div class="gs-subheader gs-header-auto-update-controls">Auto Update</div>
	  	        <div class="gs-form-group gs-container gs-col-container">
			      <div class="gs-form-field gs-row-container">
			        <label for="gs-auto-update"><span>Enabled</span></label>
		            <input type="checkbox" name="gs-auto-update" id="gs-auto-update" value="false">
			      </div>
		          <div class="gs-form-field gs-form-field-number gs-row-container">
			        <label for="gs-auto-duration"><span>Duration (s)</span></label>
		            <input type="number" name="gs-auto-duration" id="gs-auto-duration" value="60" placeholder="Duration (secs)">
			      </div>
		        </div>
		      </div>
		    </div>
          </div>
          <!--
          <div class="gs-views gs-container gs-col-container">
            <div class="gs-header gs-header-controls">Visible Sections</div>
            <div class="gs-container gs-row-container">
              <div class="gs-view-controls gs-container gs-col-container">
                <div class="gs-auto-update-controls gs-container gs-col-container">
                  <div class="gs-form-field gs-row-container">
                    <label for="gs-show-abilities"><span>Abilities</span></label>
                    <input type="checkbox" name="gs-show-abilities" id="gs-show-abilities" value="false">
                  </div>
                  <div class="gs-form-field gs-row-container">
                    <label for="gs-show-saving-throws"><span>Saving Throws</span></label>
                    <input type="checkbox" name="gs-show-saving-throws" id="gs-show-saving-throws" value="false">
                  </div>
                  <div class="gs-form-field gs-row-container">
                    <label for="gs-show-senses"><span>Senses</span></label>
                    <input type="checkbox" name="gs-show-senses" id="gs-show-senses" value="false">
                  </div>
                  <div class="gs-form-field gs-row-container">
                    <label for="gs-show-classes"><span>Classes</span></label>
                    <input type="checkbox" name="gs-show-classes" id="gs-show-classes" value="false">
                  </div>
                  <div class="gs-form-field gs-row-container">
                    <label for="gs-show-resources"><span>Resources</span></label>
                    <input type="checkbox" name="gs-show-resources" id="gs-show-resources" value="false">
                  </div>
                </div>
              </div>
            </div>
          </div>
		  <div class="gs-stored gs-container">
            <div class="gs-header gs-header-controls">Stored</div>
	        <div class="gs-container gs-row-container">
		      <div class="gs-camp-currencies gs-container gs-col-container">
                <div class="gs-subheader gs-header-camp-currencies">Currencies</div>
                <div class="gs-container gs-row-container"></div>
                <div class="gs-form-group gs-row-container">
		          <div class="gs-form-field gs-form-field-number gs-row-container">
		            <input type="number" name="gs-currency-amount" id="gs-currency-amount" placeholder="Amount">
			      </div>
		          <div class="gs-form-field gs-form-field-dropdown gs-row-container">
		            <select type="number" name="gs-currency-type" id="gs-currency-type"></select>
			      </div>
		          <div class="gs-form-field gs-form-field-button gs-row-container">
		             <button type="button" name="gs-currency-confirm" id="gs-currency-confirm">Amend</button>
			      </div>
                </div>
              </div>
            </div>
		  </div>
          -->
	    </div>
        <!--
        <div class="gs-campaign-row2 gs-container gs-row-container">
	      <div class="gs-outputs gs-container gs-col-container">
            <div class="gs-header gs-header-controls">Known Traits</div>
            <div class="gs-container gs-row-container">
	          <div class="gs-camp-languages gs-col-container">
                <div class="gs-subheader gs-header-camp-languages">Known Languages</div>
                <div class="gs-container gs-row-container"></div>
              </div>
            </div>
	      </div>
        </div>
        -->
      </div>
	</div>
  `;

var mainTableHTML = `
<table class="table">
    <thead>
        <tr>
            <th class="col_name">
                <span class="name">Name</span><br />
                <span class="exhaust"><span>E</span>xhaust</span><br />
                <span class="spellsavedc">Spell Save <span>DC</span></span>
            </th>
            <th class="col_hp">
                HP<hr />
                <span class="save">D</span>eath <span class="fail">S</span>aves
            </th>
            <th class="col_ac">AC</th>
            <th class="col_speed">
                Speed<hr />
                Senses
            </th>
            <th class="col_stat">S<br />T<br />R</th>
            <th class="col_stat">D<br />E<br />X</th>
            <th class="col_stat">C<br />O<br />N</th>
            <th class="col_stat">I<br />N<br />T</th>
            <th class="col_stat">W<br />I<br />S</th>
            <th class="col_stat">C<br />H<br />A</th>
            <th class="col_passives">
                Passives:<br />
                <span>per</span>cept<br />
                <span>inv</span>est<br />
                <span>ins</span>ight<br />
            </th>
            <th class="col_money">$$$</th>
            <th class="col_skills">Skill Proficiences</th>
            <th class="col_languages">Languages</th>
        </tr>
    </thead>
    <tbody id="gm_table_body">
    </tbody>
</table>
`;

var tableRowHTML = `
        <tr>
            <td class="col_name">
                <span class="name"></span><br/>
                <span class="exhaust"><span></span>- - - - - -</span><br/>
                <span class="spellsavedc"><span></span></span>
            </td>
            <td class="col_hp">
                <span class="hurt"></span>
            </td>
            <td class="col_ac"></td>
            <td class="col_speed"></td>
            <td class="col_stat col_str"></td>
            <td class="col_stat col_dex"></td>
            <td class="col_stat col_con"></td>
            <td class="col_stat col_int"></td>
            <td class="col_stat col_wis"></td>
            <td class="col_stat col_cha"></td>
            <td class="col_passives">
                per: <span></span><br />
                inv: <span></span><br />
                ins: <span></span>
            </td>
            <td class="col_money">
                <span class="total"></span><hr />
                <span class="ppc"><span class="pp"></span> pp</span>
                <span class="epc"><span class="ep"></span> ep </span>
                <span class="gpc"><span class="gp"></span> gp </span>
                <span class="spc"><span class="sp"></span> sp </span>
                <span class="cpc"><span class="cp"></span> cp </span>
            </td>
            <td class="col_skills"></td>
            <td class="col_languages"></td>
        </tr>
`;

var currencyHTML = `
	<div class="gs-camp-currency">
	  <div class="gs-value gs-currency-value">
	    <span class="gs-prefix gs-currency-prefix"></span><span class="gs-number gs-currency-number"></span>
	  </div>
      <div class="gs-label gs-currency-label"></div>
	</div>
	`;
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

        for (key in character_rules_engine_lib_es){
            if (typeof character_rules_engine_lib_es[key].getAbilities === 'function'){
                crk = key;
                console.log("crk found: " + key);
            }
            if (typeof character_rules_engine_lib_es[key].getSenseTypeModifierKey === 'function'){
                ktl = key;
                console.log("ktl found: " + key);
            }
        }

        for (key in Core){
            if (typeof Core[key].WALK !== 'undefined' && typeof Core[key].SWIM !== 'undefined' && typeof Core[key].CLIMB !== 'undefined' && typeof Core[key].FLY !== 'undefined' && typeof Core[key].BURROW !== 'undefined'){
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

            function getSenseData(senses){ // finds returns the label
                return Object.keys(senses).map(function(index) {
                    let indexInt = parseInt(index);
                    return {
                        id: indexInt,
                        key: charf2.getSenseTypeModifierKey(indexInt),
                        name: charf2.getSenseTypeLabel(indexInt),
                        distance: senses[indexInt]
                    }
                })
            }

            function getSpeedData(speeds){ // finds returns the label
                let halfSpeed = roundDown(divide(speeds[Core[cmov].WALK],2));
                return Object.keys(speeds).map(function(index) {
                    let distance = speeds[index];
                    if(Core[cmov].SWIM === index || Core[cmov].CLIMB === index){
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
            getCharData : getCharData,
            getAuthHeaders : getAuthHeaders,
        }
        console.log("Module 2080: end");
    }
};


//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Main Function
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

(function () {
    campaignID = window.location.pathname.match(charIDRegex);
    stylesheetUrls.forEach(loadStylesheet); //load and insert each stylesheet in the settings

    // TODO temp for dev
    const my_css = GM_getResourceText("IMPORTED_CSS");
    GM_addStyle(my_css);

    loadModules(initalModules); //load the module loader which imports from window.jsonpDDBCT and the inputted modules
    insertCampaignElements();
    findTargets();
    insertElements();
    window.moduleExport.getAuthHeaders()().then((function (headers) {
        authHeaders = headers;
        console.log("authHeaders: ", headers);
        retriveRules().then(() =>{
            updateAllCharData();
        }).catch((error) => {
            console.log(error);
        });
    }));
})();

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Functions
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------



function findTargets() {
    console.log("Locating Characters from Window");
    $(linkUrlTarget).each(function (index, value) {
        var url = value.html;
        console.debug("Processing: " + url);
        var charID = 0;
        var matchArr = value.href.match(charIDRegex);
        if (matchArr.length > 0) {
            var charIDStr = matchArr[1];
            if (charIDStr == "") {
                console.warn("error: empty charIdStr");
            } else {
                charID = parseInt(charIDStr);
            }
        } else {
            console.warn("error: no numbers found in " + value.href);
        }
        if (charID != 0) {
            let node = $(value).parents('li');
            let type = 'unknown';
            let typeNode = $(value).parents('.ddb-campaigns-detail-body-listing');
            if(typeNode.hasClass('ddb-campaigns-detail-body-listing-active')){
                let unassignedNode = $(value).parents('.ddb-campaigns-detail-body-listing-unassigned-active');
                if(unassignedNode.length > 0){
                    type = 'unassigned';
                } else {
                    type = 'active';
                }
            } else if(typeNode.hasClass('ddb-campaigns-detail-body-listing-inactive')){
                type = 'deactivated';
            }
            charactersData[charID] = {
                node: node,
                url: charJSONurlBase + charID,
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

            for (let ruleID in optionalRules){
                charactersData[charID].state.serviceData.definitionPool[optionalRules[ruleID].category] = {
                    accessTypeLookup:{},
                    definitionLookup:{},
                };
            }
        } else {
            console.warn("warn: skipping " + value.href + " due to ID not found");
        }
    });
    console.log("Finished locating Characters from Window");
    //console.debug(charactersData);
}

function insertElements() {
    console.log("Inserting Structual Elements");

    var sitemain = $("#site-main");
    var node = $("<div id='gmstats'></div>#gmstats");

    sitemain.prepend(node);
    
    node.append(mainTableHTML);

    var tableBody = $("#gm_table_body", node);

    for(let id in charactersData) {       
        var row = $(tableRowHTML);
        row.attr("id", "player-" + id);
        tableBody.append(row);

        charactersData[id].node = row;
    };
}

function retriveRules(charIDs) {
    return new Promise(function (resolve, reject) {
        console.log("Retriving Rules Data");
        getJSONfromURLs(rulesUrls).then((js) => {
            console.log("Rules Data Processing Start");
            js.forEach(function(rule, index){
                isSuccessfulJSON(rule, index);
            });
            rulesData = {
                ruleset : js[0].data,
                vehiclesRuleset : js[1].data
            }
            for(let id in charactersData){
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

function getRules(index){
    return rulesData[index];
}

function updateAllCharData() {
    console.log("Retriving Each Char Data");
    
    let promises = []
    for(let id in charactersData){
        promises.push(updateCharData(charactersData[id].url));
    }
    
    Promise.all(promises)
        .then(() =>{
        updateCampaignData();
    }).catch((error) => {
        console.log(error);
    });
    updateVisibility();

    startRefreshTimer();
    console.log("Updated All Char Data");
}

function updateCharData(url) {

    return new Promise(function (resolve, reject) {
        console.log("Retriving Char Data");
        getJSONfromURLs([url]).then((js) => {
            //window.jstest = js;
            js.forEach(function(charJSON, index){
                if(isSuccessfulJSON(charJSON, index)){
                    let charId = charJSON.data.id;
                    console.debug("Processing Char: " + charId);
                    charactersData[charId].state.character = charJSON.data;
                    let promises = retriveCharacterRules(charId)
                    Promise.all(promises).then(()=>{
                        var charData = window.moduleExport.getCharData(charactersData[charId].state);
                        charactersData[charId].data = charData;
                        updateElementData(charactersData[charId]);
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
    for(let ruleID in optionalRules){
        if(ruleID in charactersData[charId].state.character && charactersData[charId].state.character[ruleID].length > 0 ){
            console.log("Optional ruleset for " + ruleID + " found.");
            promises.push(retriveCharacterRule(charId, ruleID));
        }
    }
    return promises;
}

function retriveCharacterRule(charId, ruleID) {
    let url = gameCollectionUrl.prefix + optionalRules[ruleID].category + gameCollectionUrl.postfix;

    let ruleIds = []
    for(let item of charactersData[charId].state.character[ruleID]){
        ruleIds.push(item[optionalRules[ruleID].id]);
    }

    let body = {"campaignId":null,"sharingSetting":2,"ids":ruleIds};
    return new Promise(function (resolve, reject) {
        getJSONfromURLs([url], body).then((js) => {
            js.forEach(function(charJSON, index){
                console.log("Retrived " + ruleID + " data, processing.");
                console.log(charJSON);
                if(charJSON.success && charJSON.data.definitionData != undefined){
                    for(let data of charJSON.data.definitionData){
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

function startRefreshTimer() {
    //get timeout value
    let refreshTime = parseInt($('input[name ="gs-auto-duration"]').val());
    let refreshTimeMiliSecs = refreshTime * 1000;
    console.log("Starting Refresh Timer: " + refreshTime);
    setTimeout(function () {
        //only refresh when checkbox is checked
        if ($('input[name ="gs-auto-update"]').is(':checked')) {
            updateAllCharData();
        }else{
            startRefreshTimer();
        }
    }, refreshTimeMiliSecs);
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//        Element Updating Functions
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function insertCampaignElements() {
    console.log("Inseting Campaign Elements");
    let campaignPrefix = scriptVarPrefix + "-" + campaignID;
    $(campaignElementTarget + " > div:nth-child(1)").after(controlsHTML);
    campaignNode = $(".gs-campaign");
    insertControls(campaignNode, campaignPrefix);
    insertVisibilityControls(campaignNode, campaignPrefix);
    insertStoredElements(campaignNode, campaignPrefix);
}

function insertControls(parent, campaignPrefix) {
    console.log("Inseting Main Controls");

    let controlsNode = parent.find('.gs-controls');

    let autoUpdate = controlsNode.find('input[name ="gs-auto-update"]');
    let autoDuration = controlsNode.find('input[name ="gs-auto-duration"]');

    // Loads ideally value set for this campaign, if not found it loads the last saved value otherwise it defaults
    let autoUpdateLoaded = GM_getValue(campaignPrefix + "-autoUpdate", GM_getValue(scriptVarPrefix + "-autoUpdate", autoUpdateDefault));
    let updateDurationLoaded = GM_getValue(campaignPrefix + "-updateDuration", GM_getValue(scriptVarPrefix + "-updateDuration", updateDurationDefault))

    autoUpdate.prop('checked', autoUpdateLoaded);
    autoDuration.prop('value', updateDurationLoaded);

    autoUpdate.change(function () {
        let updatedAutoUpdate = parseBool($(this).prop("checked"));
        GM_setValue(campaignPrefix + "-autoUpdate", updatedAutoUpdate);
        GM_setValue(scriptVarPrefix + "-autoUpdate", updatedAutoUpdate);
    });
    autoDuration.change(function () {
        let updatedAutoDuration = parseIntSafe($(this).val());
        GM_setValue(campaignPrefix + "-updateDuration", updatedAutoDuration);
        GM_setValue(scriptVarPrefix + "-updateDuration", updatedAutoDuration);
    });
}

function insertVisibilityControls(parent, campaignPrefix) {
    console.log("Inseting Visibility Controls");

    let controlsNode = parent.find('.gs-views');

    let showAbilities = controlsNode.find('input[name ="gs-show-abilities"]');
    let showSavingThrows = controlsNode.find('input[name ="gs-show-saving-throws"]');
    let showSenses = controlsNode.find('input[name ="gs-show-senses"]');
    let showClasses = controlsNode.find('input[name ="gs-show-classes"]');
    let showResources = controlsNode.find('input[name ="gs-show-resources"]');

    // Loads ideally value set for this campaign, if not found it loads the last saved value otherwise it defaults
    let showAbilitiesLoaded = GM_getValue(campaignPrefix + "-showAbilities", GM_getValue(scriptVarPrefix + "-showAbilities", showAbilitiesDefault));
    let showSavingThrowsLoaded = GM_getValue(campaignPrefix + "-showSavingThrows", GM_getValue(scriptVarPrefix + "-showSavingThrows", showSavingThrowsDefault));
    let showSensesLoaded = GM_getValue(campaignPrefix + "-showSenses", GM_getValue(scriptVarPrefix + "-showSenses", showSensesDefault));
    let showClassesLoaded = GM_getValue(campaignPrefix + "-showClasses", GM_getValue(scriptVarPrefix + "-showClasses", showClassesDefault));
    let showResourcesLoaded = GM_getValue(campaignPrefix + "-showResources", GM_getValue(scriptVarPrefix + "-showResources", showResourcesDefault));

    showAbilities.prop('checked', showAbilitiesLoaded);
    showSavingThrows.prop('checked', showSavingThrowsLoaded);
    showSenses.prop('checked', showSensesLoaded);
    showClasses.prop('checked', showClassesLoaded);
    showResources.prop('checked', showResourcesLoaded);

    showAbilities.change(function () {
        let updatedShowAbilities = parseBool($(this).prop("checked"));
        GM_setValue(campaignPrefix + "-showAbilities", updatedShowAbilities);
        GM_setValue(scriptVarPrefix + "-showAbilities", updatedShowAbilities);
        updateVisibility();
    });
    showSavingThrows.change(function () {
        let updatedShowSavingThrows = parseBool($(this).prop("checked"));
        GM_setValue(campaignPrefix + "-showSavingThrows", updatedShowSavingThrows);
        GM_setValue(scriptVarPrefix + "-showSavingThrows", updatedShowSavingThrows);
        updateVisibility();
    });
    showSenses.change(function () {
        let updatedShowSensesUpdate = parseBool($(this).prop("checked"));
        GM_setValue(campaignPrefix + "-showSenses", updatedShowSensesUpdate);
        GM_setValue(scriptVarPrefix + "-showSenses", updatedShowSensesUpdate);
        updateVisibility();
    });
    showClasses.change(function () {
        let updatedShowClasses = parseBool($(this).prop("checked"));
        GM_setValue(campaignPrefix + "-showClasses", updatedShowClasses);
        GM_setValue(scriptVarPrefix + "-showClasses", updatedShowClasses);
        updateVisibility();
    });
    showResources.change(function () {
        let updatedShowResources = parseBool($(this).prop("checked"));
        GM_setValue(campaignPrefix + "-showResources", updatedShowResources);
        GM_setValue(scriptVarPrefix + "-showResources", updatedShowResources);
        updateVisibility();
    });
}

function updateVisibility() {
    console.log("Updating data visibility");

    let abilities = $('input[name ="gs-show-abilities"]').is(':checked');
    let saves = $('input[name ="gs-show-saving-throws"]').is(':checked');
    let senses = $('input[name ="gs-show-senses"]').is(':checked');
    let classes = $('input[name ="gs-show-classes"]').is(':checked');
    let resources = $('input[name ="gs-show-resources"]').is(':checked');

    $('.gs-main-able').toggle(abilities);
    $('.gs-main-saves').toggle(saves);
    $('.gs-main-able').parents('.gs-container').toggle(abilities || saves);

    $('.gs-senses').toggle(senses);
    $('.gs-classes').toggle(classes);
    $('.gs-resources').toggle(resources);
    $('.gs-senses').parents('.gs-container').toggle(senses || classes || resources);
}

function insertStoredElements(parent, campaignPrefix) {
    console.log("Inseting Stored Elements");
    let storedNode = parent.find('.gs-stored');
    insertCurrencies(storedNode, campaignPrefix);
}

function insertCurrencies(parent, campaignPrefix){
    console.log("Updating Campaign Currencies Data");
    let currenciesLoaded = GM_getValue(campaignPrefix + "-currencies", currenciesDefault);
    //console.log(currenciesLoaded);
    let container = parent.find('.gs-camp-currencies > .gs-container');

    let currencyAmount = parent.find('.gs-camp-currencies > .gs-form-group input[name="gs-currency-amount"]');
    let currencyType = parent.find('.gs-camp-currencies > .gs-form-group select[name="gs-currency-type"]');
    let currencyConfirm = parent.find('.gs-camp-currencies > .gs-form-group button[name="gs-currency-confirm"]');

    for(let id in currenciesTypeDefault){
        let currency = currenciesTypeDefault[id];
        $('<option/>', {
            value: id,
            class: 'gs-currency-type-option gs-currency-type-' + id + '-option',
            html: currency.name
        }).appendTo(currencyType);
    }

    currencyType.val(currenciesMainDefault);

    currencyConfirm.click(function () {
        let updatedAmount = parseIntSafe(currencyAmount.val());
        if(updatedAmount != 0){
            let selectedType = currencyType.val();
            if(updatedAmount != undefined){
                let currenciesUpdate = GM_getValue(campaignPrefix + "-currencies", currenciesDefault);
                if(currenciesUpdate[selectedType] == undefined){
                    currenciesUpdate[selectedType] = 0;
                }
                currenciesUpdate[selectedType] += updatedAmount;
                GM_setValue(campaignPrefix + "-currencies", currenciesUpdate);
                updateCurrency(container, selectedType, currenciesUpdate[selectedType]);
            }
        }
    });

    for(let id in currenciesLoaded){
        updateCurrency(container, id, currenciesLoaded[id]);
    }
}

function updateCurrency(parent, id, value){
    let curCurrency = parent.find('.gs-currency-' + id);
    //console.log(curCurrency);
    if (curCurrency.length < 1) {
        parent.append(currencyHTML);
        curCurrency = parent.children().last();
        curCurrency.addClass('gs-currency-' + id);
        curCurrency.find('.gs-currency-label').html(id);
    }
    curCurrency.find('.gs-currency-number').html(value);
}

function updateCampaignData(){
    // TODO campaign totals?
}


function updateElementData(character) {
    updateQuickInfo(character.node, character.data);
    updateMainInfo(character.node, character.data);
}

function updateQuickInfo(parent, character){
    console.log('update info: ', character);
    updateNameBlock(parent, character);
    updateHitPointInfo(parent, character.hitPointInfo, character.deathSaveInfo);
    updateArmorClass(parent, character.armorClass);
    // updateInitiative(parent, character.initiative); // TODO add?
    updateSpeeds(parent, character);
}

function updateNameBlock(parent, character) {
    var nameblock = parent.find('td.col_name');

    $(".name", nameblock).html(character.name);

    updateNameBlockExhaust(character, nameblock);

    updateNameBlockSaveDC(character, nameblock);
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

    var exhaustStr = "";
    for (var i = 0; i < exhaustLevel; i++) {
        exhaustStr += "• ";
    }

    var restStr = "";
    for (var i = 0; i < (maxExhaust - exhaustLevel); i++) {
        restStr += "- ";
    }

    $(".exhaust", nameblock).html("<span>{0}</span>{1}".format(exhaustStr, restStr));
}

function updateNameBlockSaveDC(character, nameblock) {
    // add any class save DCs
    var classes = character.classes;
    var spellCasterSaveDCs = character.spellCasterInfo.castingInfo.saveDcs;

    var savestr = [];
    for (var i = 0; i < classes.length; i++) {
        var c = classes[i];
        var slug = c.slug;

        if (slug == 'monk') {
            // special case for ki since it doesn't seem to show up in data
            // ki save DC = 8 + your proficiency bonus + your Wisdom modifier
            var dc = 8;
            dc += character.proficiencyBonus;

            // TODO should this be done programmatically?
            // 4 == 'wis', dnd beyond id == 5
            dc += character.abilities[4].modifier;

            savestr.push("{0} DC: <span>{1}</span>".format("Monk", dc));
            break;
        }
    }

    for (var i = 0; i < spellCasterSaveDCs.length; i++) {
        var c = spellCasterSaveDCs[i]
        var val = c.value;

        for (var j = 0; j < c.sources.length; j++) {
            var cname = c.sources[j].definition.name;
            savestr.push("{0} DC: <span>{1}</span>".format(cname, val));
        }
    }

    $(".spellsavedc", nameblock).html(savestr.join("<br />"));
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
                "{0}/{1} {2}%".format(remaining, max, pct_left),
                bonus_str,
                temp_str,
                dsstr
            )
    );
}

function updateArmorClass(parent, armorClass){
    var node = parent.find('td.col_ac');
    node.html(armorClass);
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
    speeds.forEach(function(item, index) {
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
                    tag = "div",
                    placement = "top"
            ));
        }
    }

    if (sensearr.length > 0) {
        node.append("<br />");
        node.append(sensearr.join(""));
    }
}

function updateMainInfo(parent, character){
    updateAbilties(parent, character.abilities);
    updatePassives(parent, character.passivePerception, character.passiveInvestigation, character.passiveInsight);
    updateMoney(parent, character.currencies);
    updateSkillProfs(parent, character.skills);
    updateLanguages(parent, character.proficiencyGroups);
}

function updateAbilties(parent, abilities){    
    abilities.forEach(function(item, index){
        var abilityKey = item.name;
        var cellName = ".col_" + abilityKey;

        var cell = $(cellName, parent);
        cell.empty();

        cell.append("<span class='high'>{0}</span>".format(item.totalScore));

        cell.append("<hr />");

        var mod = item.modifier;
        var color = "";
        var sign = "";
        if (mod > 0) {
            color = "high";
            sign = getSign(mod);
        } else if (mod < 0) {
            color = "low";
            sign = getSign(mod);
        }

        cell.append("<span class='{0}'>{1}{2}</span>".format(color, sign, Math.abs(mod)));
    });
}

function updatePassives(parent, passPerception, passInvestigation, passInsight){
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

function updateMoney(parent, currencies) {
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

    var hideClass = 'hide';
    updateCurrencyVis(ppc, pp, currencies.pp, hideClass);
    updateCurrencyVis(epc, ep, currencies.ep, hideClass);
    updateCurrencyVis(gpc, gp, currencies.gp, hideClass);
    updateCurrencyVis(spc, sp, currencies.sp, hideClass);
    updateCurrencyVis(cpc, cp, currencies.cp, hideClass);

    // total gp estimate
    var gpnum = currencies.gp;
    gpnum += currencies.pp * 10.0;
    gpnum += currencies.ep / 2.0;
    gpnum += currencies.sp / 10.0;
    gpnum += currencies.cp / 100.0;

    var total = $(".total", $(".col_money", parent));
    var hr = $("hr", $(".col_money", parent));
    if (gpnum > 0 && gpnum % 1 != 0) {
        gp.removeClass("gponly");
        hr.removeClass(hideClass);
        total.html("~<span>{0}</span> gp".format(roundDown(gpnum)));
    } else {
        gp.addClass("gponly");
        hr.addClass(hideClass);
        total.empty();
    }
}

function updateCurrencyVis(c, cval, val, hideClass='hide') {
    if (val > 0) { c.removeClass(hideClass); } else { c.addClass(hideClass); }
    cval.html(val);
}

function updateSkillProfs(parent, skills) {
    allskills = [];
    skills.forEach((item, idx) => {
        if (item.expertise) {
            allskills.push("<span>**{0}</span>".format(item.name, getSign(item.modifier), item.modifier));
        } else if (item.proficiency) {
            allskills.push("<span>{0}</span>".format(item.name, getSign(item.modifier), item.modifier));
        } else if (item.halfProficiency) {
            allskills.push("<span>1/2 {0}</span>".format(item.name, getSign(item.modifier), item.modifier));
        }
    });

    $(".col_skills", parent).html(allskills.join(", "));
}

function updateLanguages(parent, profGroups) {
    var langs = [];
    profGroups.forEach((item, idx) => {
        if (item.label == "Languages") {
            item.modifierGroups.forEach((lang, lidx) => {
                langs.push("<span>{0}</span>".format(lang.label));
            });
        }
    });

    $(".col_languages", parent).html(langs.join(", "));
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
        if (mode & 2 && typeof value != "string"){
            for (var key in value){
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
        }
        : function getModuleExports() {
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

function isSuccessfulJSON(js, name){
    let success = true;
    if(js.length < 1 || js.success == undefined){
        console.warn("JSON " + name + " is malformed");
        return false;
    } else if (js.success == false){
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
    for(let id in authHeaders){
        myHeaders.append(id, authHeaders[id]);
    }
    if(body != undefined && body != ''){
        options.method = 'POST'
        myHeaders.append('Accept','application/json');
        myHeaders.append('Content-Type','application/json');
        options.body = JSON.stringify(body);
    }
    if(cookies != undefined && cookies != ''){
        options.cookies = cookies;
    }
    options.credentials = 'include';
    options.headers = myHeaders;
    console.log(options);
    return fetch(url, options);
}

function getSign(input){
    let number = parseIntSafe(input);
    return number >= 0 ? positiveSign : negativeSign
}

function roundDown(input){
    let number = parseInt(input);
    if (isNaN(number)) {
        return NaN;
    }
    return Math.floor(input);
}

function roundUp(input){
    let number = parseInt(input);
    if (isNaN(number)) {
        return NaN;
    }
    return Math.ceil(input);
}

function divide(numeratorInput, denominatorInput){
    let numerator = parseInt(numeratorInput);
    let denominator = parseInt(denominatorInput);
    if (isNaN(numerator) || isNaN(denominator)) {
        return NaN;
    }
    return numerator/denominator;
}

function distanceUnit(input){
    let number = parseIntSafe(input);
    let unit = 'ft.';
    if (number && number % FEET_IN_MILES === 0) {
        number = number / FEET_IN_MILES;
        unit = 'mile' + (Math.abs(number) === 1 ? '' : 's');
    }
    return unit;
}

function parseIntSafe(input){
    let number = parseInt(input);
    if (isNaN(number)) {
        number = 0;
    }
    return number;
}

function parseBool(x) {
    return x ? true : false;
}

function addTooltip(inStr, text, tag = "span", placement = "top") {
    // https://getbootstrap.com/docs/4.0/components/tooltips/
    return "<{2} data-toggle='tooltip' data-placement='{3}' title='{1}'>{0}</{2}>".format(inStr, text, tag, placement);
}