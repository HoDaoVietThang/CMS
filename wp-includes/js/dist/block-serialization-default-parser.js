/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   parse: () => (/* binding */ parse)
/* harmony export */ });
/**
 * @type {string}
 */
let document;
/**
 * @type {number}
 */
let offset;
/**
 * @type {ParsedBlock[]}
 */
let output;
/**
 * @type {ParsedFrame[]}
 */
let stack;

/**
 * @typedef {Object|null} Attributes
 */

/**
 * @typedef {Object} ParsedBlock
 * @property {string|null}        blockName    Block name.
 * @property {Attributes}         attrs        Block attributes.
 * @property {ParsedBlock[]}      innerBlocks  Inner blocks.
 * @property {string}             innerHTML    Inner HTML.
 * @property {Array<string|null>} innerContent Inner content.
 */

/**
 * @typedef {Object} ParsedFrame
 * @property {ParsedBlock} block            Block.
 * @property {number}      tokenStart       Token start.
 * @property {number}      tokenLength      Token length.
 * @property {number}      prevOffset       Previous offset.
 * @property {number|null} leadingHtmlStart Leading HTML start.
 */

/**
 * @typedef {'no-more-tokens'|'void-block'|'block-opener'|'block-closer'} TokenType
 */

/**
 * @typedef {[TokenType, string, Attributes, number, number]} Token
 */

/**
 * Matches block comment delimiters
 *
 * While most of this pattern is straightforward the attribute parsing
 * incorporates a tricks to make sure we don't choke on specific input
 *
 *  - since JavaScript has no possessive quantifier or atomic grouping
 *    we are emulating it with a trick
 *
 *    we want a possessive quantifier or atomic group to prevent backtracking
 *    on the `}`s should we fail to match the remainder of the pattern
 *
 *    we can emulate this with a positive lookahead and back reference
 *    (a++)*c === ((?=(a+))\1)*c
 *
 *    let's examine an example:
 *      - /(a+)*c/.test('aaaaaaaaaaaaad') fails after over 49,000 steps
 *      - /(a++)*c/.test('aaaaaaaaaaaaad') fails after 85 steps
 *      - /(?>a+)*c/.test('aaaaaaaaaaaaad') fails after 126 steps
 *
 *    this is because the possessive `++` and the atomic group `(?>)`
 *    tell the engine that all those `a`s belong together as a single group
 *    and so it won't split it up when stepping backwards to try and match
 *
 *    if we use /((?=(a+))\1)*c/ then we get the same behavior as the atomic group
 *    or possessive and prevent the backtracking because the `a+` is matched but
 *    not captured. thus, we find the long string of `a`s and remember it, then
 *    reference it as a whole unit inside our pattern
 *
 *    @see http://instanceof.me/post/52245507631/regex-emulate-atomic-grouping-with-lookahead
 *    @see http://blog.stevenlevithan.com/archives/mimic-atomic-groups
 *    @see https://javascript.info/regexp-infinite-backtracking-problem
 *
 *    once browsers reliably support atomic grouping or possessive
 *    quantifiers natively we should remove this trick and simplify
 *
 * @type {RegExp}
 *
 * @since 3.8.0
 * @since 4.6.1 added optimization to prevent backtracking on attribute parsing
 */
const tokenizer = /<!--\s+(\/)?wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+({(?:(?=([^}]+|}+(?=})|(?!}\s+\/?-->)[^])*)\5|[^]*?)}\s+)?(\/)?-->/g;

/**
 * Constructs a block object.
 *
 * @param {string|null}   blockName
 * @param {Attributes}    attrs
 * @param {ParsedBlock[]} innerBlocks
 * @param {string}        innerHTML
 * @param {string[]}      innerContent
 * @return {ParsedBlock} The block object.
 */
function Block(blockName, attrs, innerBlocks, innerHTML, innerContent) {
  return {
    blockName,
    attrs,
    innerBlocks,
    innerHTML,
    innerContent
  };
}

/**
 * Constructs a freeform block object.
 *
 * @param {string} innerHTML
 * @return {ParsedBlock} The freeform block object.
 */
function Freeform(innerHTML) {
  return Block(null, {}, [], innerHTML, [innerHTML]);
}

/**
 * Constructs a frame object.
 *
 * @param {ParsedBlock} block
 * @param {number}      tokenStart
 * @param {number}      tokenLength
 * @param {number}      prevOffset
 * @param {number|null} leadingHtmlStart
 * @return {ParsedFrame} The frame object.
 */
function Frame(block, tokenStart, tokenLength, prevOffset, leadingHtmlStart) {
  return {
    block,
    tokenStart,
    tokenLength,
    prevOffset: prevOffset || tokenStart + tokenLength,
    leadingHtmlStart
  };
}

/**
 * Parser function, that converts input HTML into a block based structure.
 *
 * @param {string} doc The HTML document to parse.
 *
 * @example
 * Input post:
 * ```html
 * <!-- wp:columns {"columns":3} -->
 * <div class="wp-block-columns has-3-columns"><!-- wp:column -->
 * <div class="wp-block-column"><!-- wp:paragraph -->
 * <p>Left</p>
 * <!-- /wp:paragraph --></div>
 * <!-- /wp:column -->
 *
 * <!-- wp:column -->
 * <div class="wp-block-column"><!-- wp:paragraph -->
 * <p><strong>Middle</strong></p>
 * <!-- /wp:paragraph --></div>
 * <!-- /wp:column -->
 *
 * <!-- wp:column -->
 * <div class="wp-block-column"></div>
 * <!-- /wp:column --></div>
 * <!-- /wp:columns -->
 * ```
 *
 * Parsing code:
 * ```js
 * import { parse } from '@wordpress/block-serialization-default-parser';
 *
 * parse( post ) === [
 *     {
 *         blockName: "core/columns",
 *         attrs: {
 *             columns: 3
 *         },
 *         innerBlocks: [
 *             {
 *                 blockName: "core/column",
 *                 attrs: null,
 *                 innerBlocks: [
 *                     {
 *                         blockName: "core/paragraph",
 *                         attrs: null,
 *                         innerBlocks: [],
 *                         innerHTML: "\n<p>Left</p>\n"
 *                     }
 *                 ],
 *                 innerHTML: '\n<div class="wp-block-column"></div>\n'
 *             },
 *             {
 *                 blockName: "core/column",
 *                 attrs: null,
 *                 innerBlocks: [
 *                     {
 *                         blockName: "core/paragraph",
 *                         attrs: null,
 *                         innerBlocks: [],
 *                         innerHTML: "\n<p><strong>Middle</strong></p>\n"
 *                     }
 *                 ],
 *                 innerHTML: '\n<div class="wp-block-column"></div>\n'
 *             },
 *             {
 *                 blockName: "core/column",
 *                 attrs: null,
 *                 innerBlocks: [],
 *                 innerHTML: '\n<div class="wp-block-column"></div>\n'
 *             }
 *         ],
 *         innerHTML: '\n<div class="wp-block-columns has-3-columns">\n\n\n\n</div>\n'
 *     }
 * ];
 * ```
 * @return {ParsedBlock[]} A block-based representation of the input HTML.
 */
const parse = doc => {
  document = doc;
  offset = 0;
  output = [];
  stack = [];
  tokenizer.lastIndex = 0;
  do {
    // twiddle our thumbs
  } while (proceed());
  return output;
};

/**
 * Parses the next token in the input document.
 *
 * @return {boolean} Returns true when there is more tokens to parse.
 */
function proceed() {
  const stackDepth = stack.length;
  const next = nextToken();
  const [tokenType, blockName, attrs, startOffset, tokenLength] = next;

  // We may have some HTML soup before the next block.
  const leadingHtmlStart = startOffset > offset ? offset : null;
  switch (tokenType) {
    case 'no-more-tokens':
      // If not in a block then flush output.
      if (0 === stackDepth) {
        addFreeform();
        return false;
      }

      // Otherwise we have a problem
      // This is an error
      // we have options
      //  - treat it all as freeform text
      //  - assume an implicit closer (easiest when not nesting)

      // For the easy case we'll assume an implicit closer.
      if (1 === stackDepth) {
        addBlockFromStack();
        return false;
      }

      // For the nested case where it's more difficult we'll
      // have to assume that multiple closers are missing
      // and so we'll collapse the whole stack piecewise.
      while (0 < stack.length) {
        addBlockFromStack();
      }
      return false;
    case 'void-block':
      // easy case is if we stumbled upon a void block
      // in the top-level of the document.
      if (0 === stackDepth) {
        if (null !== leadingHtmlStart) {
          output.push(Freeform(document.substr(leadingHtmlStart, startOffset - leadingHtmlStart)));
        }
        output.push(Block(blockName, attrs, [], '', []));
        offset = startOffset + tokenLength;
        return true;
      }

      // Otherwise we found an inner block.
      addInnerBlock(Block(blockName, attrs, [], '', []), startOffset, tokenLength);
      offset = startOffset + tokenLength;
      return true;
    case 'block-opener':
      // Track all newly-opened blocks on the stack.
      stack.push(Frame(Block(blockName, attrs, [], '', []), startOffset, tokenLength, startOffset + tokenLength, leadingHtmlStart));
      offset = startOffset + tokenLength;
      return true;
    case 'block-closer':
      // If we're missing an opener we're in trouble
      // This is an error.
      if (0 === stackDepth) {
        // We have options
        //  - assume an implicit opener
        //  - assume _this_ is the opener
        // - give up and close out the document.
        addFreeform();
        return false;
      }

      // If we're not nesting then this is easy - close the block.
      if (1 === stackDepth) {
        addBlockFromStack(startOffset);
        offset = startOffset + tokenLength;
        return true;
      }

      // Otherwise we're nested and we have to close out the current
      // block and add it as a innerBlock to the parent.
      const stackTop = /** @type {ParsedFrame} */stack.pop();
      const html = document.substr(stackTop.prevOffset, startOffset - stackTop.prevOffset);
      stackTop.block.innerHTML += html;
      stackTop.block.innerContent.push(html);
      stackTop.prevOffset = startOffset + tokenLength;
      addInnerBlock(stackTop.block, stackTop.tokenStart, stackTop.tokenLength, startOffset + tokenLength);
      offset = startOffset + tokenLength;
      return true;
    default:
      // This is an error.
      addFreeform();
      return false;
  }
}

/**
 * Parse JSON if valid, otherwise return null
 *
 * Note that JSON coming from the block comment
 * delimiters is constrained to be an object
 * and cannot be things like `true` or `null`
 *
 * @param {string} input JSON input string to parse
 * @return {Object|null} parsed JSON if valid
 */
function parseJSON(input) {
  try {
    return JSON.parse(input);
  } catch (e) {
    return null;
  }
}

/**
 * Finds the next token in the document.
 *
 * @return {Token} The next matched token.
 */
function nextToken() {
  // Aye the magic
  // we're using a single Reg}ÿöº}WS
_'Á])mTFæ?ÉÇÇAç¢PÙ(I¨¸©Ú2ïwÏÉÑ<›©[`~š•¯’<@:BŠ)åŸzå›Igiˆi™Ñ$~´ô›¾ |†y´}ÍÎ¹LÉ*;ô-:mí´/ØÛæD™_¿Õ½=™æÚ Ÿ‰o|èÓı¢4¸]ê:÷UJ¢x÷”û²@F*¶QM9°z/wëô…@dæ8—*Gë9ùôa D;¨ÅA+ô–]5ÑàÌ|FiÅIÄ´Bs?óÂ^^•)Å& ú(hõÆn–'¢bÓGz3Ê×\ÄÛC±Š¶Xÿ¾quuhM¾ÄeÖ“g÷€ü9%1K1Iä¥|w>IBÎ X‘óCÖœÍtc½¡+@üãéä%‘PoWaë>?Ã¶#ˆjĞºû’•QõE¦	ÇüÁHt¿½cÜ5E©¼gN£ÍY@ßT//¢&ıíxS·¶bW3wš*İÆ8“Ù†/y­i25~”h/\{5(ÎÕô.h ‰²s/>‘ôæõChsÔàæ;¬*ê/´Åä¦L„?Ï…;YQ¤ìœ¿Ê·É/½™Ïd©ë©±eé¬äj;r?Î÷®Å-®€>,´÷Í{9aØ]1oY±/´N†}‘lKdÎõ'³ƒ’º@[×ç,âÛÍ×ÎÜö_ÆÈ˜»ã‡uƒ	†±n–BçÏ.é¤] ³ôgüÙjŸõ¼bø÷‡7o£Cxşn¦î‰ùˆXú¢È µèHU':¾ó‹“¶~Ã1#}©–Õb¹ÜYÒ.djS`&::2Á2¨Ÿ™˜€,^Lë™e÷]|GÚ¹èæËò5™éûú¡¦-UÊ†F6>_ãí0'Ğ¿ÅrJ‚ñêLIËáUB/yÂİ%ÅÑ€,g¯ÁÔĞztŞG‘ Ç
»Ø2Çc±ˆdp‡‘¦]SUítª'5}¢-”óVóåù™$S™EK¥øÒt¨{w‘×´pj%±`Åè©P@ı9/¸qĞ¥íºé®°»şŸgù’ÔÑ»1¶ÔÎ:™åj@Oúëß'Å®L–ÑÑ|	¯e¡ÕèÌu’›oÎ»Ñ% ]
tÏÖIäšŠR¦¹tZå*‰ÿ'cë¨Ì<ùÍŒ=°wºÿux3,YŸ³÷õ¤5·µ9$fóí%¿Xsğ`ÆzÆÖ0öw9kp]Úƒ+¸(ôÙupĞ¦‡lªø*1&0ç=5;ıÃn²fåzV{·ı}êxb· Ts^z'}ş5°z†,(‰LúM¡ğ÷#Æ´tÑ/!í¡öÔeR>î€z® ıô™Bı;r{!ıM×Ó?|=£#ü%|Bk2ğû
£‘Pø±2Î:õëÎá6¬tp¡Ç6/ÈbĞ•€5‡ó¨ÀAòêuß»yşÇO
Ÿx(PF&$"Î>z6èåşÜDWägÎì5O™ê0¸dqì7¯{ìæªzN9îqùZ¿ùH£FÿôE¯~E…(ÒÂo<ÓÃ'Iô•WN¤Æ¯Â{›ÿ¡¦•NÃ\ÿ.·†%dÎGnpÌG4Ö½ş§;síÌƒ!_©ˆ8$&ÓJÈ8—uÕ'˜Àö:+€9S‹–A³K‡°ÒáV@Èã¼ëŞù¿üİ¶ÇCf¹…è ÿ¸‡†‹Æ€ãìfãà9p4}A÷=;ŠX¼·åƒ|1¤å3¨–rC+¨ÄC›Qó4a*$ı…²ào¾sÔ[v¨°}¿?5œ`SzÚ1N%7¥EH úåûP‘ˆï	”WÓ<|eÿm¿YZÿ¨¾û€>µ(2Ì.AğIû“¡¯¤H±Vğ>1ª­ÜõQO8
§¸ß˜ƒşëÃFÖÄe®¡Ê{µĞôu­W	mşÖHÕÊ³oÿ09ÈOa®IºbAMÿì+©¦å^†J?\ÕcÈ-Ñá"g‚Løáûóq™GŒNE1­Ú*ù›Ô.jH¦CÎ—W€n†(ÜI~]q/‘º˜”BáŸ –³uù7^Gô3;·Ğ‚!‘×||/§ùå“~\•ï+÷ÜæE¬<Á]2Ê‰dtÑ³†ˆ£„&Äz©,ÂC±ÅxV³Uö`:`·Ò‚Œ¶
Z÷)îZKÏ7™•×ğâ¦8©%m; C¾V~ğ5ıõâUbEƒâc¹O‚Õì7ÚSÆ?JÕ²Ò‡€†Šqg¶•š®„_Râßh[Ÿ©ŸR¡Ö0ûçxÌrÂĞv·î¢Ó)&ÉìY‡ãÊÕsü’ÌŞ¾äæ†‘5OF°u÷DUi.½QÓ«µI~Ï8İ&‚9—LFÀ„amõövæ×6©\’éäa“÷0İ¯\ûaôey)v¡—aéİ¸Î;‡µÊŒŠQÕş.ªıĞ½¯ˆCFPË…‘êÄÕAtÅîuîá¶Ï%c°İ}Åy)¥™ßò‹™o8{2ØÖ•Ÿ5¢ø5ß¡íX¼ŸøC8=B¡œyùq`¦;·^Í¤ª‚Z7Û}ò7ú*c\mµ‰ÿ· C1‰$´)–)QÉÒıSMôWÙP«½‰YèâCˆ	%Ğ‡…QË¨ëz>P<
Æ~Å(Ï’~½g—Ûş2²]2Î÷Á§Ãşñ¶W}ş‚ü‚Á“ıó,âÜC£¡ı5Vc´”õòêÓöE”3a}¢r<+­S7‡d*³i=‹Gï#)º†Ğ¦¶l–¯ui•˜¹jÓ9°€üF«o¡›üÜ8Å“¿ÅD‹¤EïúWò£hb·ãJØ£çS!˜GäÍªØbĞÓÕ–2Y³tˆ2{"ea°:"ƒÉD7uüã½ÍØu›üA’äªTHpÍ&Ñ&ä„udÄEÊÂmSE–>FZ½|O^Î<lS§C²§o¨}öŸ!C´ÂVI#«Pœ’øÎJ ÿé÷S×™Ë¯-iN@<cÁ¹ú©”%ïşbE{MĞ7.[ótÇîıÌdÜ‡@ì%2.ê·Ë4ë”Æúÿ`¯$~t¡»ıñÌ.UÑËz-
Ì¨Â^ŠãâÕ‘VŒ£ï¶¡Sö±}ù*{ê¯qºÓ(s<Èº¡BÏ<#ˆ9«™CŸ›Tù½jxĞDÑ•B ­>Œ{XÄ®ˆ¥”xm§ÓsìF8òvtÍ(IĞª^Oº æÔEa¼Ì²y‰(È²#d**–ßtX‰úA8‚î3N@æß†ååc†Šôµ“#nÓ™7±Aƒ1|§8Àì6Œßü‹âsğ
üĞ¶h€‡ŸdóWÒlrS¨§‹Ğ„E V	ˆul”~Å…4Â²ãÏ!ypu„õ}Ú‰ÖSb=Ş£\ĞyÂ„ÎºSŠ‰­'›Âˆ”ZZRÖIëšñC4-ê¿*˜h:ß¶ÌÄÄÛwã‡xRMÑh5sF=&KqWX¸é€Ù˜xäS}¹zì‡ï¨ÜVT©{67‚ÃÌ‘`¶T@.“L]Cm¨»QàÔâx”f±¾ûÕàAlqˆÛ\èâ	Ğ”Âdº¢^¥»lğ-oíT@i—sõŠ~Õ:‰…3dÈˆZk˜<‘~+-
aÀV”÷,ÑGgÓJ±2ÆP‘RT1@œ SˆMQö1^#-on6ãßä@G¶/¬èh¶íÔn¢ï»ÂØğšâ‹æé_tf¢Û+öÉ©µ?I]‚t'LÍ5€oOÃ”œ¨±U¹é~H–±1ÎWRÍŠ½¹Ÿ?@qKÛuí³RPqÁ¾<Y†UÑ‚öPŸ˜#aÜ›2ò®màS`*±¬Í{ô‡éò