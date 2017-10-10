import { SchemaTransformer } from "./SchemaTransformer";
import { OneAst as one } from "./Ast";
import { Context as TiContext } from "./Transforms/ResolveIdentifiersTransform";
import { LangFileSchema } from "../Generator/LangFileSchema";

export class SchemaContext {
    arrayType: string;
    mapType: string;
    transformer: SchemaTransformer;
    tiContext = new TiContext();

    constructor(public schema: one.Schema) {
        this.transformer = SchemaTransformer.instance;
    }

    ensureTransforms(...transformNames: string[]) {
        this.transformer.ensure(this, ...transformNames);
    }

    addDependencySchema(schema: one.Schema, type: "overlay"|"stdlib") {
        for (const glob of Object.values(schema.globals))
            this.tiContext.addLocalVar(glob);
        
        for (const cls of Object.values(schema.classes)) {
            cls.meta = cls.meta || {};
            cls.meta[type] = true;
            this.tiContext.classes.addClass(cls);
        }
    }

    getClass(name: string): one.Class {
        return this.schema.classes[name] || this.tiContext.classes.classes[name];
    }
}