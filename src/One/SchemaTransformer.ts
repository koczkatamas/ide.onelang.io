import { OneAst as one } from "./Ast";
import { SchemaContext } from "./SchemaContext";

export interface ISchemaTransform {
    name: string;
    dependencies?: string[];
    transform(schemaCtx: SchemaContext);
    revert?(schemaCtx: SchemaContext);
}

export class SchemaTransformer {
    static instance = new SchemaTransformer();

    transformers: { [name: string]: ISchemaTransform } = {};

    constructor() { }

    log(data: string) {
        console.log(`[SchemaTransformHandler] ${data}`);
    }

    addTransform(trans: ISchemaTransform) {
        this.transformers[trans.name] = trans;
    }

    ensure(schemaCtx: SchemaContext, ...transformNames: string[]) {
        const schema = schemaCtx.schema;
        if (!schema.meta) schema.meta = {};
        if (!schema.meta.transforms) schema.meta.transforms = {};

        for (const transformName of transformNames) {
            if(schema.meta.transforms[transformName]) continue;
            
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