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
  // we're using a single Reg}���}WS
_'�])mTF�?���A�P�(I����2�w���<��[`~����<@:B�)�z�Igi�i��$~���� |�y�}�ιL�*;�-:m�/���D�_�ս=���ڠ��o|����4��]�:�UJ��x����@F*�QM9�z/w��@d�8�*G�9��a�D;��A+��]5��̏|Fi�IĴBs?��^^�)�& �(h��n�'��b�Gz3��\��C���X���quuhM��e֓g���9%1K1I�|w>IBΠX��C֜�tc���+@����%�PoWa�>?ö#�jк���Q�E�	���Ht��c�5E��gN��Y@�T//�&��xS��bW3w�*��8�ن/y�i25�~�h/\{5�(���.h ��s/>����Chs���;�*�/���L�?υ;YQ�윿ʷ�/���d�����e���j;r?����-��>,���{9a��]1�oY�/�N�}�lKd��'����@[��,�������_�Ș��u�	��n�B��.�] ��g��j���b���7o�Cx�n����X��� ��HU':���~�1#}���b��Y�.djS`&::2�2�����,^L�e�]|Gڹ����5�������-UʆF6>_��0'�п�rJ���LIː�UB/y�%�р,g����zt�G���
���2�c���dp���]SU�t�'5}�-��V����$S�EK���t�{w��״pj%�`��P@�9/�qХ�鮰����g���ѻ1���:��j@O���'ŮL���|	�e�����u��oλэ% ]
t��I����R��tZ�*��'c��<�͌=�w��ux3,Y������5��9$f��%�X�s�`�z��0�w9kp]ڃ+�(��upЦ�l��*1&0�=5;��n�f�zV{��}�xb��Ts^z'}�5�z�,(�L�M���#Ə�t�/!���eR>�z� ���B�;r{!�M��?|=�#�%|Bk2��
��P��2�:����6�tp��6/�bЕ�5���A��u߻y��O
�x(�PF&$"�>z6����DW�g��5O��0�dq�7�{�恐�zN�9�q�Z���H�F��E�~E�(��o<��'I��WN�Ư��{�����N�\�.��%d�Gnp��G4ֽ��;s�̃!_���8$&�J�8�u�'���:+�9S��A�K�����V@�������ݶ�Cf���������ƀ��f��9p4}A�=;�X����|1��3��rC+��C��Q�4a*$�����o�s�[v���}�?5�`Sz�1N%7�EH ���P���	�W�<|e��m�YZ�����>�(2�.A�I�����H�V�>1����QO8
��ߘ����F���e���{���u�W	m��H�ʳo�09�Oa�I�bAM��+���^�J?\�c�-��"g�L����q�G�NE1��*���.jH�CΗW�n�(�I~]q/�����B០��u�7^G�3;���!��||/���~\��+���E�<�]2ʉdt������&�z�,�C��xV�U�`:`�҂��
Z�)�ZK�7�����8�%m;��C�V~�5���UbE���c�O���7�S�?Jղ҇���qg�����_R��h[����R��0��x�r��v����)&��Y����s���޾�憑5OF��u�DUi.�Qӫ�I~��8�&�9�LF��am��v��6��\���a��0ݯ\�a�ey)v��a�ݸ�;��ʌ�Q��.��н���CFP˅����At��u���%c��}�y)�����o8{2�֕�5���5ߡ�X���C8=B��y�q`�;�^ͤ��Z7�}�7�*c\m���� C1�$�)��)Q���SM�W�P���Y��C�	%Ї�Q˨�z>P<
�~�(��~�g�����2�]2��������W}���������,��C���5Vc��������E�3a}�r<+�S7�d*�i�=��G�#)���Ц�l��ui���j�9���F�o����8œ��D��E��W��hb��J؁��S!�G�ͪ��b��Ֆ2Y�t�2{"ea�:"��D7u����u��A���THp�&�&�ud�E��mSE�>FZ�|O^�<lS�C��o�}��!C���VI#�P����J ���S���˯-iN@<c�����%��bE{M�7.[�t����d܇@�%2.���4����`�$~�t�����.U��z-
̨�^���ՑV�����S���}�*{�q��(s<���B�<#�9��C��T��jx�DѕB �>�{XĮ���xm��s�F8�vt�(IЪ^O� ��Ea�̲y�(Ȳ#d**��tX���A8��3N@�߆��c�����#nӐ�7�A�1|�8��6�ߍ���s�
�жh���d�W�lrS�����E�V	�ul�~Ņ4²��!ypu��}ډ�Sb=ޣ\�yκS���'����ZZR�I��C4-�*�h:������w�xRM�h5sF=&KqWX����x�S}�z����VT�{67��̑`�T@.�L]Cm��Q���x�f�����Alq��\��	Д�d��^��l�-o�T@i�s��~�:��3dȈZk�<�~+-
a�V��,�Gg�J��2�P�RT1@� S�MQ�1^#-on6���@G�/��h���n��������_tf��+�ɩ�?I]�t'L�5�oOÔ���U��~H��1�WR�͊���?@qK�u�RPq��<�Y�Uт�P��#a��2�m�S`*���{���