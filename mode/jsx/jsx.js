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
        xmlState = xmlMode.startState(),
        openingTag = /^\s*<[^/]+>/,
        closingTag = /^\s*<\/.+>/,
        selfClosingTag = /^\s*<.+\/\s*>/;

    function tokenBase(stream, state) {
      // If current mode is XML but editor has been marked to switch back to
      // JavaScript in next iteration, switch mode to JavaScript.
      if (state.currentMode == "xml") {
        var switchToJS = state.shouldSwitchToJS && state.tagClosed;

        if (switchToJS) {
          state.currentMode = "js";
          // Reset switches
          state.shouldSwitchToJS = false;
          state.tagClosed = false;
        }
      }

      // If current mode is not XML and an XML opening, closing or self-closing
      // tag gets detected next, switch editor mode to XML.
      if (state.currentMode != "xml") {
        var switchToXML = stream.match(openingTag, false) ||
                          stream.match(closingTag, false) ||
                          stream.match(selfClosingTag, false);
        if (switchToXML) {
          state.currentMode = "xml";
        }
      }

      // If the editor is runing in XML mode and an XML closing or self-closing
      // tag gets detected, we should start with JavaScript-first parsing, after
      // advancing the next ">" character.
      if (state.currentMode == "xml" && !state.shouldSwitchToJS) {
        state.shouldSwitchToJS = stream.match(closingTag, false) ||
                                 stream.match(selfClosingTag, false);
      }

      // If an XML closing or self-closing tag has been detected, make sure to
      // save it in the state, when the tag gets closed.
      if (state.currentMode == "xml") {
        if (state.shouldSwitchToJS && (stream.peek() == ">")) {
          state.tagClosed = true;
        }
      }

      if (state.currentMode == "xml") {
        return xmlMode.token(stream, xmlState);
      }

      return jsMode.token(stream, jsState);
    }

    return {
      startState: function () {
        return {
          tokenize: tokenBase,
          currentMode: 'js' // We are defaulting to JavaScript as the initial mode
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
