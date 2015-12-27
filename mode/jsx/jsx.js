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
        selfClosingTag = /^\s*<.+\/\s*>/,
        incompleteTag = /^\s*<[^>]+$/;

    function tokenBase(stream, state) {
      // If current mode is XML but editor has been marked to switch back to
      // JavaScript in next iteration, switch mode to JavaScript.
      if (state.currentMode == "xml") {
        var switchToJS = state.context.shouldSwitchToJS && state.context.tagClosed;

        if (switchToJS) {
          // Reset switches
          state.context.shouldSwitchToJS = false;
          state.context.tagClosed = false;
          state.context.nextMode = "js";
        }
      }

      if (state.context.nextMode == "js") {
        state.currentMode = "js";
        state.context.nextMode = null;
      }

      // If current mode is not XML and an XML opening, closing or self-closing
      // tag gets detected next, switch editor mode to XML.
      if (state.currentMode != "xml" && !state.context.inAttrJSExpression) {
        var switchToXML = stream.match(openingTag, false) ||
                          stream.match(closingTag, false) ||
                          stream.match(selfClosingTag, false) ||
                          stream.match(incompleteTag, false);
        if (switchToXML) {
          state.context.nextMode = "xml";
        }
      }

      if (state.context.nextMode == "xml") {
        state.currentMode = "xml";
        state.context.nextMode = null;
      }

      // If the editor is runing in XML mode and an XML closing or self-closing
      // tag gets detected, we should start with JavaScript-first parsing, after
      // advancing the next ">" character or next "/>".
      if (state.currentMode == "xml" && !state.context.shouldSwitchToJS) {
        state.context.shouldSwitchToJS = stream.match(closingTag, false) ||
                                 stream.match(selfClosingTag, false);
      }

      // If an XML closing or self-closing tag or tag closure has been
      // detected, make sure to save it in the state.
      if (state.currentMode == "xml") {
        if (state.context.shouldSwitchToJS) {
          state.context.tagClosed = (stream.peek() == ">");
        } else if (stream.match("/>", false)) {
          state.context.shouldSwitchToJS = true;
          state.context.tagClosed = true;
        }
      }

      // Detecting a "{" in XML mode means that a JavaScript expression
      // is about to follow. We should switch to back to JavaScript mode in
      // next iteration.
      // Source: http://facebook.github.io/react/docs/jsx-in-depth.html#javascript-expressions
      if (state.currentMode == "xml") {
        var attributeJavaScriptExpression = (stream.peek() == "{"),
            childJavaScriptExpression = (stream.match(/>\s*\{/, false));

        if (attributeJavaScriptExpression) {
          state.context.inJSExpression = true;
          state.context.inAttrJSExpression = true;
          state.context.nextMode = "js";
          stream.next();
          return null;
        }
      }

      // Detecting a "}" when in a JavaScript expression means that the
      // JavaScript expression finished and we should return back to XML mode.
      if (state.currentMode == "js" && stream.peek() == "}" && state.context.inJSExpression) {
        state.context.inJSExpression = false;
        state.context.inAttrJSExpression = false;

        // If the JavaScript expression that just finished is an attribute value
        // the XML parser is still waiting for a valid XML attribute value;
        // text enclosed in quotes or double-quotes, or a single word. We should
        // change the state of the XML parser to move forward and not wait for
        // an XML attribute value.
        if (state.xmlState.state.name == "attrValueState") {
          state.xmlState.state = state.xmlState.state("string");
        }

        state.context.nextMode = "xml";
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
          xmlState: xmlMode.startState(),
          context: {}
        };
      },
      copyState: function (state) {
        return {
          tokenize: state.tokenize,
          jsState: CodeMirror.copyState(jsMode, state.jsState),
          xmlState: CodeMirror.copyState(xmlMode, state.xmlState),
          context: state.context,
          currentMode: state.currentMode
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
