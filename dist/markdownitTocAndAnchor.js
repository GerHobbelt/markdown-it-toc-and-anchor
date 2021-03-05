/*! markdown-it-toc-and-anchor 4.5.0-6 https://github.com//GerHobbelt/markdown-it-toc-and-anchor @license MIT */

import clone from 'clone';
import uslug from 'uslug';

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

// Token class




/**
 * class Token
 **/

/**
 * new Token(type, tag, nesting)
 *
 * Create new token and fill passed properties.
 **/
function Token(type, tag, nesting) {
  /**
   * Token#type -> String
   *
   * Type of the token (string, e.g. "paragraph_open")
   **/
  this.type     = type;

  /**
   * Token#tag -> String
   *
   * html tag name, e.g. "p"
   **/
  this.tag      = tag;

  /**
   * Token#attrs -> Array
   *
   * Html attributes. Format: `[ [ name1, value1 ], [ name2, value2 ] ]`
   **/
  this.attrs    = null;

  /**
   * Token#map -> Array
   *
   * Source map info. Format: `[ line_begin, line_end ]`
   **/
  this.map      = null;

  /**
   * Token#nesting -> Number
   *
   * Level change (number in {-1, 0, 1} set), where:
   *
   * -  `1` means the tag is opening
   * -  `0` means the tag is self-closing
   * - `-1` means the tag is closing
   **/
  this.nesting  = nesting;

  /**
   * Token#level -> Number
   *
   * nesting level, the same as `state.level`
   **/
  this.level    = 0;

  /**
   * Token#children -> Array
   *
   * An array of child nodes (inline and img tokens)
   **/
  this.children = null;

  /**
   * Token#content -> String
   *
   * In a case of self-closing tag (code, html, fence, etc.),
   * it has contents of this tag.
   **/
  this.content  = '';

  /**
   * Token#markup -> String
   *
   * '*' or '_' for emphasis, fence string for fence, etc.
   **/
  this.markup   = '';

  /**
   * Token#info -> String
   *
   * fence infostring
   **/
  this.info     = '';

  /**
   * Token#meta -> Object
   *
   * A place for plugins to store an arbitrary data
   **/
  this.meta     = null;

  /**
   * Token#block -> Boolean
   *
   * True for block-level tokens, false for inline tokens.
   * Used in renderer to calculate line breaks
   **/
  this.block    = false;

  /**
   * Token#hidden -> Boolean
   *
   * If it's true, ignore this element when rendering. Used for tight lists
   * to hide paragraphs.
   **/
  this.hidden   = false;

  /**
   * Token#position -> Number
   *
   * Position in the original string
   **/
  this.position = 0;

  /**
   * Token#size -> Number
   *
   * Size of the token
   **/
  this.size     = 0;
}


/**
 * Token.attrIndex(name) -> Number
 *
 * Search attribute index by name.
 **/
Token.prototype.attrIndex = function attrIndex(name) {
  let attrs;

  if (!this.attrs) { return -1; }

  attrs = this.attrs;

  return attrs.findIndex(function (el) {
    return el[0] === name;
  });
};


/**
 * Token.attrPush(attrData)
 *
 * Add `[ name, value ]` attribute to list. Init attrs if necessary
 **/
Token.prototype.attrPush = function attrPush(attrData) {
  if (this.attrs) {
    this.attrs.push(attrData);
  } else {
    this.attrs = [ attrData ];
  }
};


/**
 * Token.attrSet(name, value)
 *
 * Set `name` attribute to `value`. Override old value if exists.
 **/
Token.prototype.attrSet = function attrSet(name, value) {
  let idx = this.attrIndex(name),
      attrData = [ name, value ];

  if (idx < 0) {
    this.attrPush(attrData);
  } else {
    this.attrs[idx] = attrData;
  }
};


/**
 * Token.attrGet(name)
 *
 * Get the value of attribute `name`, or null if it does not exist.
 **/
Token.prototype.attrGet = function attrGet(name) {
  let idx = this.attrIndex(name), value = null;
  if (idx >= 0) {
    value = this.attrs[idx][1];
  }
  return value;
};


/**
 * Token.attrJoin(name, value)
 *
 * Join value to existing attribute via space. Or create new attribute if not
 * exists. Useful to operate with token classes.
 **/
Token.prototype.attrJoin = function attrJoin(name, value) {
  let idx = this.attrIndex(name);

  if (idx < 0) {
    this.attrPush([ name, value ]);
  } else {
    this.attrs[idx][1] = this.attrs[idx][1] + ' ' + value;
  }
};


/**
 * Token.clone()
 *
 * Obtain a shallow clone of the token.  You can use this while rendering to
 * prevent modifying the token list while rendering.
 **/

Token.prototype.clone = function clone() {
  let token = new Token(this.type, this.tag, this.nesting);

  token.attrs = this.attrs;
  token.level = this.level;
  token.children = this.children;
  token.content = this.content;
  token.map = this.map;
  token.markup = this.markup;
  token.info = this.info;
  token.meta = this.meta;
  token.block = this.block;
  token.hidden = this.hidden;

  return token;
};

var token = Token;

const DEFAULT_TOC_PATTERN = /@\[toc\]/im;
const TOC_MARKUP = 'TOC';

let markdownItSecondInstance = () => {};

let headingIds = {};
let tocHtml = '';

const repeat = (string, num) => new Array(num + 1).join(string);

const makeSafe = (string, headingIds, slugifyFn) => {
  const key = slugifyFn(string); // slugify

  if (!headingIds[key]) {
    headingIds[key] = 0;
  }

  headingIds[key]++;
  return key + (headingIds[key] > 1 ? `-${headingIds[key]}` : '');
};

const space = () => {
  return _extends({}, new token('text', '', 0), {
    content: ' '
  });
};

const defaultSlugifyFn = string => {
  return uslug(string, {
    lower: false
  });
};

const renderAnchorLinkSymbol = options => {
  if (options.anchorLinkSymbolClassName) {
    return [_extends({}, new token('span_open', 'span', 1), {
      attrs: [['class', options.anchorLinkSymbolClassName]]
    }), _extends({}, new token('text', '', 0), {
      content: options.anchorLinkSymbol
    }), new token('span_close', 'span', -1)];
  }

  return [_extends({}, new token('text', '', 0), {
    content: options.anchorLinkSymbol
  })];
};

const renderAnchorLink = (anchor, options, tokens, idx) => {
  const attrs = [];

  if (options.anchorClassName != null) {
    attrs.push(['class', options.anchorClassName]);
  }

  attrs.push(['href', `#${anchor}`]);

  const openLinkToken = _extends({}, new token('link_open', 'a', 1), {
    attrs
  });

  const closeLinkToken = new token('link_close', 'a', -1);

  if (options.wrapHeadingTextInAnchor) {
    tokens[idx + 1].children.unshift(openLinkToken);
    tokens[idx + 1].children.push(closeLinkToken);
  } else {
    const linkTokens = [openLinkToken, ...renderAnchorLinkSymbol(options), closeLinkToken]; // `push` or `unshift` according to anchorLinkBefore option
    // space is at the opposite side.

    const actionOnArray = {
      'false': 'push',
      'true': 'unshift'
    }; // insert space between anchor link and heading ?

    if (options.anchorLinkSpace) {
      linkTokens[actionOnArray[!options.anchorLinkBefore]](space());
    }

    tokens[idx + 1].children[actionOnArray[options.anchorLinkBefore]](...linkTokens);
  }
};

const treeToMarkdownBulletList = (tree, indent = 0) => tree.map(item => {
  const indentation = '  ';
  let node = `${repeat(indentation, indent)}*`;

  if (item.heading.content) {
    const contentWithoutAnchor = item.heading.content.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    node += ' ' + `[${contentWithoutAnchor}](#${item.heading.anchor})\n`;
  } else {
    node += '\n';
  }

  if (item.nodes.length) {
    node += treeToMarkdownBulletList(item.nodes, indent + 1);
  }

  return node;
}).join('');

const generateTocMarkdownFromArray = (headings, options) => {
  const tree = {
    nodes: []
  }; // create an ast

  headings.forEach(heading => {
    if (heading.level < options.tocFirstLevel || heading.level > options.tocLastLevel) {
      return;
    }

    let i = 1;
    let lastItem = tree;

    for (; i < heading.level - options.tocFirstLevel + 1; i++) {
      if (lastItem.nodes.length === 0) {
        lastItem.nodes.push({
          heading: {},
          nodes: []
        });
      }

      lastItem = lastItem.nodes[lastItem.nodes.length - 1];
    }

    lastItem.nodes.push({
      heading: heading,
      nodes: []
    });
  });
  return treeToMarkdownBulletList(tree.nodes);
};

function index (md, options) {
  options = _extends({
    toc: true,
    tocClassName: 'markdownIt-TOC',
    tocPattern: DEFAULT_TOC_PATTERN,
    tocFirstLevel: 1,
    tocLastLevel: 6,
    tocCallback: null,
    anchorLink: true,
    anchorLinkSymbol: '#',
    anchorLinkBefore: true,
    anchorClassName: 'markdownIt-Anchor',
    resetIds: true,
    anchorLinkSpace: true,
    anchorLinkSymbolClassName: null,
    wrapHeadingTextInAnchor: false,
    appendIdToHeading: true
  }, options);
  markdownItSecondInstance = clone(md);
  const patternCharLength = options.tocPattern.source.replace(/\\/g, '').length; // initialize key ids for each instance

  headingIds = {};
  md.core.ruler.push('init_toc', function (state) {
    const tokens = state.tokens; // reset key ids for each document

    if (options.resetIds) {
      headingIds = {};
    }

    const tocArray = [];
    let tocMarkdown = '';
    let tocTokens = [];
    const slugifyFn = typeof options.slugify === 'function' && options.slugify || defaultSlugifyFn;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'heading_close') {
        continue;
      }

      const heading = tokens[i - 1];
      const heading_close = tokens[i];

      if (heading.type === 'inline') {
        let content;

        if (heading.children && heading.children.length > 0 && heading.children[0].type === 'link_open') {
          // headings that contain links have to be processed
          // differently since nested links aren't allowed in markdown
          content = heading.children[1].content;
          heading._tocAnchor = makeSafe(content, headingIds, slugifyFn);
        } else {
          content = heading.content;
          heading._tocAnchor = makeSafe(heading.children.reduce((acc, t) => acc + t.content, ''), headingIds, slugifyFn);
        }

        if (options.anchorLinkPrefix) {
          heading._tocAnchor = options.anchorLinkPrefix + heading._tocAnchor;
        }

        tocArray.push({
          content,
          anchor: heading._tocAnchor,
          level: +heading_close.tag.substr(1, 1)
        });
      }
    }

    tocMarkdown = generateTocMarkdownFromArray(tocArray, options);
    tocTokens = markdownItSecondInstance.parse(tocMarkdown, state.env); // Adding tocClassName to 'ul' element

    if (typeof tocTokens[0] === 'object' && tocTokens[0].type === 'bullet_list_open') {
      const attrs = tocTokens[0].attrs = tocTokens[0].attrs || [];

      if (options.tocClassName != null) {
        attrs.push(['class', options.tocClassName]);
      }
    }

    tocHtml = markdownItSecondInstance.renderer.render(tocTokens, markdownItSecondInstance.options, state.env);

    if (typeof state.env.tocCallback === 'function') {
      state.env.tocCallback.call(undefined, tocMarkdown, tocArray, tocHtml);
    } else if (typeof options.tocCallback === 'function') {
      options.tocCallback.call(undefined, tocMarkdown, tocArray, tocHtml);
    } else if (typeof md.options.tocCallback === 'function') {
      md.options.tocCallback.call(undefined, tocMarkdown, tocArray, tocHtml);
    }
  });
  md.inline.ruler.after('emphasis', 'toc', state => {
    let token; // Detect TOC markdown

    const match = options.tocPattern.exec(state.src);

    if (!match) {
      return false;
    }

    const matchStart = match.index;

    if (state.pos < matchStart) {
      return false;
    } // Build content


    token = state.push('toc_open', 'toc', 1);
    token.markup = TOC_MARKUP;
    token = state.push('toc_body', '', 0);
    token = state.push('toc_close', 'toc', -1); // Update pos so the parser can continue

    state.pos += patternCharLength;
    return true;
  });

  if (options.appendIdToHeading) {
    const originalHeadingOpen = md.renderer.rules.heading_open || function (...args) {
      const [tokens, idx, options,, self] = args;
      return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.heading_open = function (...args) {
      const [tokens, idx,,,] = args;
      const attrs = tokens[idx].attrs = tokens[idx].attrs || [];
      const anchor = tokens[idx + 1]._tocAnchor;
      attrs.push(['id', anchor]);

      if (options.anchorLink) {
        renderAnchorLink(anchor, options, ...args);
      }

      return originalHeadingOpen.apply(this, args);
    };
  }

  md.renderer.rules.toc_open = () => '';

  md.renderer.rules.toc_close = () => '';

  md.renderer.rules.toc_body = () => '';

  if (options.toc) {
    md.renderer.rules.toc_body = () => tocHtml;
  }
}

export default index;
//# sourceMappingURL=markdownItTocAndAnchor.modern.js.map
