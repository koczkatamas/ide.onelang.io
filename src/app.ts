require("./Utils/Extensions.js");
global["YAML"] = require('yamljs'); 
const fs = require("fs");
import { writeFile, readFile, jsonRequest } from "./Utils/NodeUtils";
import { OneCompiler } from "./OneCompiler";
import { langConfigs, LangConfig, CompileResult } from "./Generator/LangConfigs";

declare var YAML;

const prgName = "Test";

const compiler = new OneCompiler();
compiler.saveSchemaStateCallback = (type: "overviewText"|"schemaJson", schemaType: "program"|"overlay"|"stdlib", name: string, data: string) => {
    writeFile(`tmp/${schemaType === "program" ? prgName : schemaType}_${name}.${type === "overviewText" ? "txt" : "json"}`, data); 
};

const programCode = readFile(`input/${prgName}.ts`);
const overlayCode = readFile(`langs/NativeResolvers/typescript.ts`);
const stdlibCode = readFile(`langs/StdLibs/stdlib.d.ts`);
const genericTransforms = readFile(`langs/NativeResolvers/GenericTransforms.yaml`);
compiler.parseFromTS(programCode, overlayCode, stdlibCode, genericTransforms);

const langs = Object.values(langConfigs);
for (const lang of langs) {
    //if (lang.name !== "go") continue;

    const langYaml = readFile(`langs/${lang.name}.yaml`);
    const codeGen = compiler.getCodeGenerator(langYaml, lang.name);
    lang.request.code = codeGen.generate(true);

    writeFile(`tmp/${prgName}.${codeGen.lang.extension}`, codeGen.generatedCode);
    writeFile(`tmp/TemplateGenerators_${lang.name}.js`, codeGen.templateObjectCode);
}

// run compiled codes
async function executeCodes() {
    await Promise.all(langs.map(async lang => {
        const result = await jsonRequest<CompileResult>(`http://127.0.0.1:${lang.port}/compile`, lang.request);
        console.log(lang.name, result);
    }));
}

//executeCodes();