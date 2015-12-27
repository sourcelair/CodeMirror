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
          multilineTagIndentPastTag: parserConfig.multilineTagIndentPastTag,
          allowMissing: true
        }),
        openingTag = /^\s*<[^/]+>/,
        closingTag = /^\s*<\/.+>/,
        selfClosingTag = /^\s*<.+\/\s*>/;

    function tokenBase(stream, state) {
      // If current mode is XML but editor has been marked to switch back to
      // JavaScript in next iteration, switch mode to JavaScript.
      if (state.currentMode == "xml") {
        var switchToJS = state.shouldSwitchToJS && state.tagClosed;

        if (switchToJS) {
          // Reset switches
          state.shouldSwitchToJS = false;
          state.tagClosed = false;
          state.switchToJS = true;
        }
      }

      if (state.switchToJS) {
        state.currentMode = "js";
        state.switchToJS = false;
      }

      // If current mode is not XML and an XML opening, closing or self-closing
      // tag gets detected next, switch editor mode to XML.
      if (state.currentMode != "xml") {
        var switchToXML = stream.match(openingTag, false) ||
                          stream.match(closingTag, false) ||
                          stream.match(selfClosingTag, false);
        if (switchToXML) {
          state.switchToXML = "xml";
        }
      }

      if (state.switchToXML) {
        state.currentMode = "xml";
        state.switchToXML = false;
      }

      // If the editor is runing in XML mode and an XML closing or self-closing
      // tag gets detected, we should start with JavaScript-first parsing, after
      // advancing the next ">" character or next "/>".
      if (state.currentMode == "xml" && !state.shouldSwitchToJS) {
        state.shouldSwitchToJS = stream.match(closingTag, false) ||
                                 stream.match(selfClosingTag, false);
      }

      // If an XML closing or self-closing tag has been detected, make sure to
      // save it in the state, when the tag gets closed.
      if (state.currentMode == "xml") {
        if (state.shouldSwitchToJS) {
          state.tagClosed = (stream.peek() == ">") ||
                            (stream.match("/>", false));
        }
      }

      // Detecting a "{" in XML mode means that a JavaScript expression
      // is about to follow. We should switch to back to JavaScript mode and
      // increment the JavaScript expression level by one.
      // Source: http://facebook.github.io/react/docs/jsx-in-depth.html#javascript-expressions
      if (state.currentMode == "xml" && stream.peek() == "{") {
        state.jsExpressionLevel++;
        state.switchToJS = true;
        stream.next();
        return null;
      }

      // Detecting a "}" when in a JavaScript expression means that the
      // JavaScript expression finished and we should return back to XML mode.
      if (state.currentMode == "js" && stream.peek() == "}") {
        state.jsExpressionLevel--;

        // If the JavaScript expression that just finished is an attribute value
        // the XML parser is still waiting for a valid XML attribute value;
        // text enclosed in quotes or double-quotes, or a single word. We should
        // change the state of the XML parser to move forward and not wait for
        // an XML attribute value.
        if (state.xmlState.state.name == "attrValueState") {
          state.xmlState.state = state.xmlState.state("string");
        }

        state.switchToXML = true;
        stream.next();
        return null;
      }

      if (state.currentMode == "xml") {
        return xmlMode.token(stream, state.xmlState);
      }

      return jsMode.token(stream, state.jsState);
    }

    return {
      startState: function () {
        return {
          tokenize: tokenBase,
          currentMode: 'js', // Default to JavaScript as the initial mode,
          jsExpressionLevel: 0,
          jsState: jsMode.startState(),
          xmlState: xmlMode.startState()
        };
      },
      copyState: function (state) {
        return {
          tokenize: state.tokenize,
          jsState: CodeMirror.copyState(jsMode, state.jsState),
          xmlState: CodeMirror.copyState(xmlMode, state.xmlState)
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
