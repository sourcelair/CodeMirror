// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// TODO actually recognize syntax of TypeScript constructs

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
    var jsMode = CodeMirror.getMode(config, {
          name: "javascript"
        }),
        xmlMode = CodeMirror.getMode(config, {
          name: "xml",
          htmlMode: true,
          multilineTagIndentFactor: parserConfig.multilineTagIndentFactor,
          multilineTagIndentPastTag: parserConfig.multilineTagIndentPastTag
        }),
        jsState = jsMode.startState(),
        xmlState = xmlMode.startState();

    function tokenBase(stream, state) {
      if (stream.peek() == "<") {
        if (state.currentMode != "xml") {
          state.currentMode = "xml";
        } else if (stream.match("</", false)) {
          if (state.currentMode == "xml") {
            state.possibleTagClosing = true;
          }
        }
      } else if (stream.peek() == ">") {
        if (state.possibleTagClosing && state.currentMode == "xml") {
          state.currentMode = "js";
          delete state.possibleTagClosing;
        }
      } else if (stream.match("/>", false)) {
        if (state.currentMode == "xml") {
          state.possibleTagClosing = true;
        }
      }

      if (state.currentMode == "xml") {
        return xmlMode.token(stream, xmlState);
      }

      if (state.currentMode != "js") {
        state.currentMode = "js";
      }

      return jsMode.token(stream, jsState);
    }

    return {
      startState: function () {
        return {
          tokenize: tokenBase
        };
      },
      token: function (stream, state) {
        return state.tokenize(stream, state);
      },
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
      jsMode: CodeMirror.getMode({}, "javascript"),
      xmlMode: CodeMirror.getMode({}, "xml")
    };
  });

  CodeMirror.defineMIME("text/x-jsx", "jsx");

});
