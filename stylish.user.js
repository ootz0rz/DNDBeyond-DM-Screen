// ==UserScript==
// @name            Carm DnD Beyond Profile (Dark Mode) Spell Coloring
// @namespace       https://github.com/ootz0rz/DNDBeyond-DM-Screen/
// @version         1.0.0
// @description     Adjusts some color coding to spells when viewing a profile
// @author          ootz0rz
// @match           http://www.dndbeyond.com/characters/*
// @match           https://www.dndbeyond.com/characters/*
// @match           https://www.dndbeyond.com/profile/*/characters/*
// @match           http://www.dndbeyond.com/profile/*/characters/*
// @updateURL       https://github.com/ootz0rz/DNDBeyond-DM-Screen/raw/master/stylish.js
// @license         MIT; https://github.com/ootz0rz/DNDBeyond-DM-Screen/blob/master/LICENSE
// @run-at          document-start
// ==/UserScript==

(function() {var css = "";
if (false || (new RegExp("^https://www.dndbeyond.com/characters/.*?$")).test(document.location.href) || (new RegExp("^https://www.dndbeyond.com/profile/.*?/characters/.*?$")).test(document.location.href) || (new RegExp("^http://www.dndbeyond.com/profile/.*?/characters/.*?$")).test(document.location.href))
	css += [
		" .ddbc-spell-name, .ddbc-spell-name--dark-mode {color: inherit !important;}.ct-spells-spell__name {color: #fff !important;}.ct-spells-spell__label--scaled {color: #3c8cc2 !important;}.ddbc-combat-attack__action .ddbc-combat-attack__tohit .ddbc-signed-number, .ddbc-combat-attack__action .ddbc-combat-attack__save, .ddbc-combat-attack__action .ct-spells-spell__tohit .ddbc-signed-number, .ddbc-combat-attack__action .ct-spells-spell__save, .ct-spells-spell__attacking .ddbc-combat-attack__tohit .ddbc-signed-number, .ct-spells-spell__attacking .ddbc-combat-attack__save, .ct-spells-spell__attacking .ct-spells-spell__tohit .ddbc-signed-number, .ct-spells-spell__attacking .ct-spells-spell__save {background-color: #581212;color: #f15555;font-weight: bold;padding-top: 0.2em;padding-bottom: 0.2em;padding-left: 0.15em;padding-right: 0.15em;margin-right: 1.1rem;}.ddbc-combat-attack__action .ddbc-signed-number .ddbc-signed-number__sign, .ddbc-combat-attack__action .ddbc-signed-number .ddbc-combat-attack__save-label, .ddbc-combat-attack__action .ddbc-combat-attack__save .ddbc-signed-number__sign, .ddbc-combat-attack__action .ddbc-combat-attack__save .ddbc-combat-attack__save-label, .ct-spells-spell__attacking .ddbc-signed-number .ddbc-signed-number__sign, .ct-spells-spell__attacking .ddbc-signed-number .ddbc-combat-attack__save-label, .ct-spells-spell__attacking .ddbc-combat-attack__save .ddbc-signed-number__sign, .ct-spells-spell__attacking .ddbc-combat-attack__save .ddbc-combat-attack__save-label {color: #ca6262;}.ddbc-combat-attack__action .ddbc-signed-number .ddbc-signed-number__number, .ddbc-combat-attack__action .ddbc-signed-number .ddbc-combat-attack__save-value, .ddbc-combat-attack__action .ddbc-combat-attack__save .ddbc-signed-number__number, .ddbc-combat-attack__action .ddbc-combat-attack__save .ddbc-combat-attack__save-value, .ct-spells-spell__attacking .ddbc-signed-number .ddbc-signed-number__number, .ct-spells-spell__attacking .ddbc-signed-number .ddbc-combat-attack__save-value, .ct-spells-spell__attacking .ddbc-combat-attack__save .ddbc-signed-number__number, .ct-spells-spell__attacking .ddbc-combat-attack__save .ddbc-combat-attack__save-value {color: #efa3a3;}.ddbc-combat-attack__action .ct-spells-spell__tohit .ddbc-signed-number__sign, .ct-spells-spell__attacking .ct-spells-spell__tohit .ddbc-signed-number__sign {color: #ca6262;}.ddbc-combat-attack__action .ct-spells-spell__tohit .ddbc-signed-number__number, .ct-spells-spell__attacking .ct-spells-spell__tohit .ddbc-signed-number__number {color: #efa3a3;}.ddbc-combat-attack__action .ct-spells-spell__save .ct-spells-spell__save-label, .ct-spells-spell__attacking .ct-spells-spell__save .ct-spells-spell__save-label {color: #ca6262;}.ddbc-combat-attack__action .ct-spells-spell__save .ct-spells-spell__save-value, .ct-spells-spell__attacking .ct-spells-spell__save .ct-spells-spell__save-value {color: #efa3a3;}.ddbc-combat-attack__damage .ddbc-combat-item-attack__damage, .ddbc-combat-attack__damage .ddbc-spell-damage-effect__damages, .ct-spells-spell__damage .ddbc-combat-item-attack__damage, .ct-spells-spell__damage .ddbc-spell-damage-effect__damages {background-color: #581212;color: #f15555;font-weight: bold;padding-top: 0.2em;padding-bottom: 0.2em;padding-left: 0.15em;padding-right: 0.15em;margin-right: 1.1rem;}.ddbc-combat-attack__damage .ddbc-combat-item-attack__damage .ddbc-damage__value, .ct-spells-spell__damage .ddbc-combat-item-attack__damage .ddbc-damage__value {color: #efa3a3;}.ddbc-combat-attack__damage .ddbc-spell-damage-effect__damages .ddbc-damage__value, .ct-spells-spell__damage .ddbc-spell-damage-effect__damages .ddbc-damage__value {color: #efa3a3;}.ddbc-combat-attack__damage .ddbc-spell-damage-effect__healing, .ct-spells-spell__damage .ddbc-spell-damage-effect__healing {background-color: #225811;color: #9bf87e;font-weight: bold;padding-top: 0.2em;padding-bottom: 0.2em;padding-left: 0.15em;padding-right: 0.15em;margin-right: 1.1rem;}",
	].join("\n");
if (typeof GM_addStyle != "undefined") {
	GM_addStyle(css);
} else if (typeof PRO_addStyle != "undefined") {
	PRO_addStyle(css);
} else if (typeof addStyle != "undefined") {
	addStyle(css);
} else {
	var node = document.createElement("style");
	node.type = "text/css";
	node.appendChild(document.createTextNode(css));
	var heads = document.getElementsByTagName("head");
	if (heads.length > 0) {
		heads[0].appendChild(node);
	} else {
		// no head yet, stick it whereever
		document.documentElement.appendChild(node);
	}
}
})();
