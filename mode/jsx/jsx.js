// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"), require("../javascript/javascript"),
        require("../xml/xml"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror", "../javascript/javascript", "../xml/xml"],
           mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  CodeMirror.defineMode("jsx", function(config, parserConfig) {
    var openingTag = /^\s*<[^/]+>/,
        closingTag = /^\s*<\/.+>/,
        selfClosingTag = /^\s*<.+\/\s*>/,
        incompleteTag = /^\s*<[^>]+$/,
        incompleteClosingTag = /^\s*<\/[^>]$/,
        tagOpen = /^\s*</,
        closingTagOpen = /^\s*<\//,
        modes = {
          'js': CodeMirror.getMode(config, {
            name: "javascript"
          }),
          'xml': CodeMirror.getMode(config, {
            name: "xml",
            htmlMode: true,
            multilineTagIndentFactor: parserConfig.multilineTagIndentFactor,
            multilineTagIndentPastTag: parserConfig.multilineTagIndentPastTag,
            allowMissing: true
          })
        };

    function tokenBase(stream, state) {
      if (state.context.nextMode) {
        state.currentMode = state.context.nextMode;
        state.context.nextMode = null;
      }

      // If current mode is not XML and an XML tag opening gets detected next,
      // switch editor mode to XML.
      // ATTENTION: This should not happen inside an attribute JavaScript
      // expression, since XML structures are not valid XML attributes.
      if (state.currentMode != "xml" && !state.context.inAttrJSExpression) {
        if (stream.match(tagOpen, false)) {
          state.currentMode = "xml";
        }
      }

      if (state.currentMode == "xml") {
        // If a closing tag gets detected, switch to JavaScript mode after
        // next ">".
        if (stream.match(closingTagOpen, false)) {
          state.context.inClosingTag = true;
        }
        // or if an tag opening gets detected, switch to JavaScript mode after
        // "/>", if detected.
        else if (stream.match(tagOpen, false)) {
          state.context.inTag = true;
        }

        // If a ">" got detected while we are in a self-closing tag, switch
        // to JavaScript mode in the next iteration.
        if (state.context.inClosingTag && stream.peek() == ">") {
          state.context.inClosingTag = false;
          state.context.nextMode = "js";
        }

        // If a "/>" got detected while we are in a tag, switch
        // to JavaScript mode in the next iteration.
        if (state.context.inTag && stream.match("/>", false)) {
          state.context.inTag = false;
          state.context.nextMode = "js";
        }
      }

      // Detecting a "{" in XML mode means that a JavaScript expression
      // is about to follow. We should switch to back to JavaScript mode in
      // next iteration.
      if (state.currentMode == "xml") {
        var attributeJavaScriptExpression = (stream.peek() == "{"),
            childJavaScriptExpression = (stream.match(/>\s*\{/, false));

        if (attributeJavaScriptExpression) {
          state.context.inJSExpression = true;
          state.context.inAttrJSExpression = true;
          state.context.jsExpressionOpenBraces = 0;
          state.context.nextMode = "js";
          stream.next();
          return null;
        }
      }

      if (state.currentMode == "js" && state.context.inJSExpression) {
        // Count the times that "{" has been used in the current JavaScript
        // expression, in order to exit JavaScript mode only when no dangling
        // "{" exists.
        if (stream.peek() == "{") {
          state.context.jsExpressionOpenBraces++;
        }
        // Detecting a "}" when in a JavaScript expression means that either
        // the JavaScript expression finished and we should return back to XML
        // mode or that an internal JavaScript object got closed.
        else if (stream.peek() == "}") {
          if (!state.context.jsExpressionOpenBraces) {
            state.context.inJSExpression = false;
            state.context.inAttrJSExpression = false;

            // If the JavaScript expression that just finished is an attribute
            // value the XML parser is still waiting for a valid XML attribute
            // value; text enclosed in quotes or double-quotes, or a single
            // word. We should change the state of the XML parser to move
            // forward and not wait for an XML attribute value.
            if (state.modeStates.xml.state.name == "attrValueState") {
              state.modeStates.xml.state = state.modeStates.xml.state("string");
            }

            state.context.nextMode = "xml";
            stream.next();
            return null;
          } else {
            state.context.jsExpressionOpenBraces--;
          }
        }
      }

      var currentMode = modes[state.currentMode],
          currentModeState = state.modeStates[state.currentMode];

      return currentMode.token(stream, currentModeState);
    }

    return {
      startState: function () {
        return {
          tokenize: tokenBase,
          currentMode: 'js',
          jsExpressionLevel: 0,
          modeStates: {
            'js': modes.js.startState(),
            'xml': modes.xml.startState()
          },
          context: {}
        };
      },
      copyState: function (state) {
        return {
          tokenize: state.tokenize,
          modeStates: {
            'js': CodeMirror.copyState(modes.js, state.modeStates.js),
            'xml': CodeMirror.copyState(modes.xml, state.modeStates.xml)
          },
          context: state.context,
          currentMode: state.currentMode
        };
      },
      token: function (stream, state) {
        return state.tokenize(stream, state);
      },
      innerMode: function (state) {
        return {
          state: state.modeStates[state.currentMode],
          mode: modes[state.currentMode]
        };
      },
      indent: function (state, textAfter, fullLine) {
        return modes[state.currentMode].indent(state, textAfter, fullLine);
      },
      electricInput: /^\s*(?:case .*?:|default:|\{|\})$/,
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
      lineComment: "//",
      fold: "brace",
      closeBrackets: "()[]{}''\"\"``",
      helperType: "javascript",
    };
  });

  CodeMirror.defineMIME("text/x-jsx", "jsx");
});
