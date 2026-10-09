// WebForge dev-only Vite plugin — see wf-inspector.js for the runtime half.
// Requires devDependencies: @babel/parser @babel/traverse @babel/generator @babel/types
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

module.exports = function webforgeLocPlugin() {
  return {
    name: "webforge-loc",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0];
      if (id.includes("node_modules") || !/\.[jt]sx$/.test(file)) return null;
      const relPath = path.relative(process.cwd(), file);
      let ast;
      try {
        ast = parser.parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] });
      } catch (e) {
        return null;
      }
      let changed = false;
      traverse(ast, {
        JSXOpeningElement(p) {
          const nameNode = p.node.name;
          // plain host tags (<div>, <button>, ...) are a JSXIdentifier;
          // wrapper components that forward props straight to a DOM tag
          // (framer-motion's <motion.div>, <motion.button>, ...) use a
          // JSXMemberExpression instead, named after the tag they render —
          // tag those too, since the wrapper passes data-* attrs through.
          let tagLike = false;
          if (t.isJSXIdentifier(nameNode)) {
            tagLike = /^[a-z]/.test(nameNode.name);
          } else if (t.isJSXMemberExpression(nameNode) && t.isJSXIdentifier(nameNode.property)) {
            tagLike = /^[a-z]/.test(nameNode.property.name);
          }
          if (!tagLike) return;
          if (p.node.attributes.some((a) => t.isJSXAttribute(a) && a.name && a.name.name === "data-wf-loc")) return;
          const loc = p.node.loc;
          if (!loc) return;
          p.node.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier("data-wf-loc"),
              t.stringLiteral(`${relPath}:${loc.start.line}:${loc.start.column}`)
            )
          );
          changed = true;
        },
      });
      if (!changed) return null;
      const out = generate(ast, { retainLines: true }, code);
      return { code: out.code, map: null };
    },
  };
};
