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
    var tagOpen = /^\s*</,
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
      if (state.nextMode) {
        state.currentMode = state.nextMode;
        state.nextMode = null;
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

        // If a ">" got detected while we are in a self-closing tag, switch
        // to JavaScript mode in the next iteration.
        if (state.context.inClosingTag && stream.peek() == ">") {
          state.context.inClosingTag = false;
          state.nextMode = "js";
        }

        // Switch to JavaScript mode after "/>", if detected.
        if (stream.match("/>", false)) {
          state.nextMode = "js";
        }

        // Detecting a "{" in XML mode means that a JavaScript expression
        // is about to follow. We should switch to back to JavaScript mode in
        // next iteration.
        if (stream.peek() == "{") {
          state.context.inJSExpression = true;
          state.context.jsExpressionOpenBraces = 0;
          if (state.modeStates.xml.state.name == "attrValueState") {
            state.context.inAttrJSExpression = true;
          } else {
            state.context.inAttrJSExpression = false;
          }
          state.nextMode = "js";
          stream.next();
          return null;
        }

        // If a closing bracket gets detected, while we are in a JavaScript
        // expression, exit the JavaScript expression.
        if (stream.peek() == "}" && state.context.inJSExpression) {
            state.context.inJSExpression = false;
            state.context.inAttrJSExpression = false;
            stream.next();
            return null;
        }

        // If XML mode is not in base state, allow for JavaScript comments
        // by passing control to JavaScript mode and re-gaining control after
        // comment completion.
        if (state.modeStates.xml.state.name != "baseState") {
          if (stream.match("/*", false)) {
            state.nextMode = "js";
            state.context.inMultiLineComment = true;
            return null;
          } else if (stream.match("//", false)) {
            state.nextMode = "js";
            state.context.inInlineComment = true;
            return null;
          }
        }
      }

      if (state.currentMode == "js") {
        // If JSX multiline comment ending detected, when in JavaScript mode
        // handle control to XML mode afterwards.
        if (state.context.inMultiLineComment && stream.match(/.*\*\//, false)) {
          state.nextMode = "xml";
          state.context.inMultiLineComment = false;
        // If editor is in JSX inline comment highlighting, when in JavaScript
        // mode handle control to XML mode afterwards.
        } else if (state.context.inInlineComment) {
          state.nextMode = "xml";
          state.context.inInlineComment = false;
        }

        if (state.context.inJSExpression) {
          // Count the times that "{" has been used in the current JavaScript
          // expression, in order to exit JavaScript mode only when no dangling
          // "{" exists.
          if (stream.peek() == "{") {
            state.context.jsExpressionOpenBraces++;
          }
          // Detecting a "}" when in a JavaScript expression means that either
          // the JavaScript expression finished and we should return back to
          // XML mode or that an internal JavaScript object got closed.
          else if (stream.peek() == "}") {
            if (!state.context.jsExpressionOpenBraces) {
              // If the JavaScript expression that just finished is an
              // attribute value the XML parser is still waiting for a valid
              // XML attribute value; text enclosed in quotes or double-quotes,
              // or a single word. We should change the state of the XML parser
              // to move forward and not wait for an XML attribute value.
              if (state.modeStates.xml.state.name == "attrValueState") {
                state.modeStates.xml.state = state.modeStates.xml.state("string");
              }

              // Do not advance character in JavaScript mode. Pass control to
              // XML mode.
              state.nextMode = "xml";
              return null;
            } else {
              state.context.jsExpressionOpenBraces--;
            }
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
          nextMode: null,
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
          context: {
            inJSExpression: state.context.inJSExpression,
            inClosingTag: state.context.inClosingTag,
            inAttrJSExpression: state.context.inAttrJSExpression,
            jsExpressionOpenBraces: state.context.jsExpressionOpenBraces,
            inMultiLineComment: state.context.inMultiLineComment,
            inInlineComment: state.context.inInlineComment
          },
          currentMode: state.currentMode,
          nextMode: state.nextMode
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
        var currentMode = modes[state.currentMode],
            currentModeState = state.modeStates[state.currentMode];

        return currentMode.indent(currentModeState, textAfter, fullLine);
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
