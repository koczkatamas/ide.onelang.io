(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SchemaTransformer {
        constructor() {
            this.transformers = {};
        }
        log(data) {
            console.log(`[SchemaTransformHandler] ${data}`);
        }
        addTransform(trans) {
            this.transformers[trans.name] = trans;
        }
        ensure(schemaCtx, ...transformNames) {
            const schema = schemaCtx.schema;
            if (!schema.meta)
                schema.meta = {};
            if (!schema.meta.transforms)
                schema.meta.transforms = {};
            for (const transformName of transformNames) {
                if (schema.meta.transforms[transformName])
                    continue;
                const transformer = this.transformers[transformName];
                if (!transformer) {
                    this.log(`Transformer "${transformName}" not found!`);
                    continue;
                }
                if (transformer.dependencies)
                    this.ensure(schemaCtx, ...transformer.dependencies);
                transformer.transform(schemaCtx);
                schema.meta.transforms[transformName] = true;
            }
        }
    }
    SchemaTransformer.instance = new SchemaTransformer();
    exports.SchemaTransformer = SchemaTransformer;
});
//# sourceMappingURL=SchemaTransformer.js.map