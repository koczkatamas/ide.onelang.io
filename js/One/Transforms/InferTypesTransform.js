(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../Ast", "../AstHelper", "../AstTransformer"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Ast_1 = require("../Ast");
    const AstHelper_1 = require("../AstHelper");
    const AstTransformer_1 = require("../AstTransformer");
    var ReferenceType;
    (function (ReferenceType) {
        ReferenceType[ReferenceType["Class"] = 0] = "Class";
        ReferenceType[ReferenceType["Method"] = 1] = "Method";
        ReferenceType[ReferenceType["MethodVariable"] = 2] = "MethodVariable";
        ReferenceType[ReferenceType["ClassVariable"] = 3] = "ClassVariable";
    })(ReferenceType = exports.ReferenceType || (exports.ReferenceType = {}));
    class Reference {
    }
    exports.Reference = Reference;
    class GenericsMapping {
        constructor(map) {
            this.map = map;
        }
        static log(data) { console.log(`[GenericsMapping] ${data}`); }
        static create(cls, realClassType) {
            if (cls.typeArguments.length !== (realClassType.typeArguments || []).length) {
                this.log(`Type argument count mismatch! '${cls.type.repr()}' <=> '${realClassType.repr()}'`);
                return null;
            }
            const resolveDict = {};
            for (let i = 0; i < cls.typeArguments.length; i++)
                resolveDict[cls.typeArguments[i]] = realClassType.typeArguments[i];
            return new GenericsMapping(resolveDict);
        }
        replace(type) {
            let newType = Ast_1.OneAst.Type.Load(type);
            if (type.isGenerics) {
                const resolvedType = this.map[type.genericsName];
                if (!resolvedType)
                    GenericsMapping.log(`Generics '${type.genericsName}' is not mapped. Mapped types: ${Object.keys(this.map).join(", ")}.`);
                else
                    newType = Ast_1.OneAst.Type.Load(resolvedType);
            }
            if (newType.isClassOrInterface)
                for (let i = 0; i < newType.typeArguments.length; i++)
                    newType.typeArguments[i] = this.replace(newType.typeArguments[i]);
            return newType;
        }
    }
    exports.GenericsMapping = GenericsMapping;
    class InferTypesTransform extends AstTransformer_1.AstTransformer {
        constructor(schemaCtx) {
            super();
            this.schemaCtx = schemaCtx;
            this.methodReturnTypes = [];
        }
        visitType(type) {
            super.visitType(type, null);
            if (!type)
                return;
            if (type.isClass && this.schemaCtx.getInterface(type.className))
                type.typeKind = Ast_1.OneAst.TypeKind.Interface;
        }
        visitIdentifier(id) {
            this.log(`No identifier should be here!`);
        }
        visitTemplateString(expr) {
            super.visitTemplateString(expr, null);
            expr.valueType = Ast_1.OneAst.Type.Class("OneString");
        }
        syncTypes(type1, type2) {
            if (!type1 || type1.isAny || type1.isGenerics)
                return type2;
            if (!type2 || type2.isAny || type2.isGenerics)
                return type1;
            const errorPrefix = `Cannot sync types (${type1.repr()} <=> ${type2.repr()})`;
            if (type1.typeKind !== type2.typeKind) {
                this.log(`${errorPrefix}: kind mismatch!`);
            }
            else if (type1.isClassOrInterface) {
                if (type1.className !== type2.className) {
                    this.log(`${errorPrefix}: class name mismatch!`);
                }
                else if (type1.typeArguments.length !== type2.typeArguments.length) {
                    this.log(`${errorPrefix}: type argument length mismatch!`);
                }
                else {
                    type1.typeKind = type2.typeKind; // class -> interface if needed
                    for (let i = 0; i < type1.typeArguments.length; i++)
                        type1.typeArguments[i] = type2.typeArguments[i] =
                            this.syncTypes(type1.typeArguments[i], type2.typeArguments[i]);
                }
            }
            return type1;
        }
        visitVariableDeclaration(stmt) {
            super.visitVariableDeclaration(stmt, null);
            if (stmt.initializer)
                stmt.type = this.syncTypes(stmt.type, stmt.initializer.valueType);
        }
        visitCastExpression(expr) {
            expr.expression.valueType = expr.newType;
            AstHelper_1.AstHelper.replaceProperties(expr, expr.expression);
            this.visitExpression(expr);
        }
        visitForeachStatement(stmt) {
            this.visitExpression(stmt.items);
            const itemsType = stmt.items.valueType;
            const itemsClass = this.schemaCtx.getClass(itemsType.className);
            if (!itemsClass || !itemsClass.meta.iterable || itemsType.typeArguments.length === 0) {
                console.log(`Tried to use foreach on a non-array type: ${itemsType.repr()}!`);
                stmt.itemVariable.type = Ast_1.OneAst.Type.Any;
            }
            else {
                stmt.itemVariable.type = itemsType.typeArguments[0];
            }
            this.visitBlock(stmt.body, null);
        }
        visitBinaryExpression(expr) {
            super.visitBinaryExpression(expr, null);
            // TODO: really big hack... 
            if (["<=", ">=", "===", "==", "!==", "!="].includes(expr.operator))
                expr.valueType = Ast_1.OneAst.Type.Class("OneBoolean");
            else if (expr.left.valueType.isNumber && expr.right.valueType.isNumber)
                expr.valueType = Ast_1.OneAst.Type.Class("OneNumber");
            else if (expr.left.valueType.isBoolean && expr.right.valueType.isBoolean)
                expr.valueType = Ast_1.OneAst.Type.Class("OneBoolean");
            else if (expr.left.valueType.isString)
                expr.valueType = Ast_1.OneAst.Type.Class("OneString");
            else
                expr.valueType = expr.left.valueType; // TODO: also hack...
        }
        visitConditionalExpression(expr) {
            super.visitConditionalExpression(expr, null);
            const trueType = expr.whenTrue.valueType;
            const falseType = expr.whenFalse.valueType;
            if (trueType.equals(falseType)) {
                expr.valueType = trueType;
            }
            else if (trueType.isNull && !falseType.isNull) {
                expr.valueType = falseType;
            }
            else if (!trueType.isNull && falseType.isNull) {
                expr.valueType = trueType;
            }
            else {
                if (trueType.isClassOrInterface && falseType.isClassOrInterface) {
                    expr.valueType = this.schemaCtx.findBaseClass(trueType.className, falseType.className);
                    if (expr.valueType)
                        return;
                }
                this.log(`Could not determine type of conditional expression. Type when true: ${trueType.repr()}, when false: ${falseType.repr()}`);
            }
        }
        visitReturnStatement(stmt) {
            super.visitReturnStatement(stmt, null);
            if (stmt.expression)
                this.methodReturnTypes.push(stmt.expression.valueType);
        }
        visitUnaryExpression(expr) {
            this.visitExpression(expr.operand);
            if (expr.operand.valueType.isNumber)
                expr.valueType = Ast_1.OneAst.Type.Class("OneNumber");
        }
        visitElementAccessExpression(expr) {
            super.visitElementAccessExpression(expr, null);
            // TODO: use the return type of get() method
            const typeArgs = expr.object.valueType.typeArguments;
            if (typeArgs && typeArgs.length === 1)
                expr.valueType = expr.valueType || typeArgs[0];
        }
        visitCallExpression(expr) {
            super.visitCallExpression(expr, null);
            if (!expr.method.valueType.isMethod) {
                this.log(`Tried to call a non-method type '${expr.method.valueType.repr()}'`);
                return;
            }
            const className = expr.method.valueType.classType.className;
            const methodName = expr.method.valueType.methodName;
            const cls = this.schemaCtx.getClassOrInterface(className, true);
            const method = this.schemaCtx.getMethod(className, methodName);
            if (!method) {
                this.log(`Method not found: ${className}::${methodName}`);
                return;
            }
            expr.valueType = Ast_1.OneAst.Type.Load(method.returns);
            const thisExpr = expr.method.thisExpr;
            if (thisExpr) {
                const genMap = GenericsMapping.create(cls, thisExpr.valueType);
                if (genMap)
                    expr.valueType = genMap.replace(expr.valueType);
            }
        }
        visitNewExpression(expr) {
            super.visitNewExpression(expr, null);
            expr.valueType = Ast_1.OneAst.Type.Load(expr.cls.valueType);
            expr.valueType.typeArguments = expr.typeArguments;
        }
        visitLiteral(expr) {
            if (expr.valueType)
                return;
            if (expr.literalType === "numeric" || expr.literalType === "string" || expr.literalType === "boolean" || expr.literalType === "character")
                expr.valueType = Ast_1.OneAst.Type.Class(this.schema.langData.literalClassNames[expr.literalType]);
            else if (expr.literalType === "null")
                expr.valueType = Ast_1.OneAst.Type.Null;
            else
                this.log(`Could not infer literal type: ${expr.literalType}`);
        }
        visitParenthesizedExpression(expr) {
            super.visitParenthesizedExpression(expr, null);
            expr.valueType = expr.expression.valueType;
        }
        visitPropertyAccessExpression(expr) {
            super.visitPropertyAccessExpression(expr, null);
            const objType = expr.object.valueType;
            if (objType.isEnum) {
                const enum_ = this.schemaCtx.schema.enums[objType.enumName];
                if (!enum_) {
                    this.log(`Enum not found: ${objType.enumName}`);
                    return;
                }
                const enumMember = enum_.values.find(x => x.name === expr.propertyName);
                if (!enumMember) {
                    this.log(`Enum member '${expr.propertyName}' not found in enum '${objType.enumName}'`);
                    return;
                }
                const newValue = new Ast_1.OneAst.EnumMemberReference(enumMember, enum_);
                const newExpr = AstHelper_1.AstHelper.replaceProperties(expr, newValue);
                newExpr.valueType = objType;
                return;
            }
            if (!objType.isClassOrInterface) {
                this.log(`Cannot access property '${expr.propertyName}' on object type '${expr.object.valueType.repr()}'.`);
                return;
            }
            const method = this.schemaCtx.getMethod(objType.className, expr.propertyName);
            if (method) {
                const thisIsStatic = expr.object.exprKind === Ast_1.OneAst.ExpressionKind.ClassReference;
                const thisIsThis = expr.object.exprKind === Ast_1.OneAst.ExpressionKind.ThisReference;
                if (method.static && !thisIsStatic)
                    this.log("Tried to call static method via instance reference");
                else if (!method.static && thisIsStatic)
                    this.log("Tried to call non-static method via static reference");
                const newValue = new Ast_1.OneAst.MethodReference(method, thisIsStatic ? null : expr.object);
                const newExpr = AstHelper_1.AstHelper.replaceProperties(expr, newValue);
                newExpr.valueType = Ast_1.OneAst.Type.Method(objType, method.name);
                return;
            }
            const fieldOrProp = this.schemaCtx.getFieldOrProp(objType.className, expr.propertyName);
            if (fieldOrProp) {
                const newValue = fieldOrProp.static ? Ast_1.OneAst.VariableRef.StaticField(expr.object, fieldOrProp) :
                    Ast_1.OneAst.VariableRef.InstanceField(expr.object, fieldOrProp);
                const newExpr = AstHelper_1.AstHelper.replaceProperties(expr, newValue);
                newExpr.valueType = fieldOrProp.type;
                return;
            }
            this.log(`Member not found: ${objType.className}::${expr.propertyName}`);
        }
        visitArrayLiteral(expr) {
            super.visitArrayLiteral(expr, null);
            let itemType = expr.items.length > 0 ? expr.items[0].valueType : Ast_1.OneAst.Type.Any;
            if (expr.items.some(x => !x.valueType.equals(itemType)))
                itemType = Ast_1.OneAst.Type.Any;
            expr.valueType = expr.valueType || Ast_1.OneAst.Type.Class(this.schemaCtx.arrayType, [itemType]);
        }
        visitMapLiteral(expr) {
            super.visitMapLiteral(expr, null);
            let itemType = expr.properties.length > 0 ? expr.properties[0].type : Ast_1.OneAst.Type.Any;
            if (expr.properties.some(x => !x.type.equals(itemType)))
                itemType = Ast_1.OneAst.Type.Any;
            expr.valueType = Ast_1.OneAst.Type.Class(this.schemaCtx.mapType, [Ast_1.OneAst.Type.Class("OneString"), itemType]);
        }
        visitExpression(expression) {
            super.visitExpression(expression, null);
            if (!expression.valueType)
                expression.valueType = Ast_1.OneAst.Type.Any;
        }
        visitClassReference(expr) {
            expr.valueType = expr.classRef.type || expr.valueType;
        }
        visitEnumReference(expr) {
            expr.valueType = expr.enumRef.type || expr.valueType;
        }
        visitThisReference(expr) {
            expr.valueType = this.currentClass.type || expr.valueType;
        }
        visitVariableRef(expr) {
            super.visitVariableRef(expr, null);
            expr.valueType = expr.varRef.type || expr.valueType;
        }
        visitMethodReference(expr) {
            expr.valueType = expr.methodRef.type || expr.valueType;
        }
        visitMethod(method) {
            method.type = Ast_1.OneAst.Type.Method(method.classRef.type, method.name);
            this.methodReturnTypes = [];
            super.visitMethod(method, null);
            // TODO: implement this for > 1        
            if (method.returns.isAny && method.body) {
                const returnTypes = this.methodReturnTypes.filter(x => !x.isAny);
                if (returnTypes.length == 1) {
                    method.returns = this.methodReturnTypes[0];
                }
                else if (returnTypes.length == 0) {
                    method.returns = Ast_1.OneAst.Type.Void;
                }
            }
        }
        visitClass(cls) {
            cls.type = Ast_1.OneAst.Type.Class(cls.name, cls.typeArguments.map(t => Ast_1.OneAst.Type.Generics(t)));
            super.visitClass(cls, null);
        }
        visitInterface(intf) {
            intf.type = Ast_1.OneAst.Type.Interface(intf.name, intf.typeArguments.map(t => Ast_1.OneAst.Type.Generics(t)));
            super.visitInterface(intf, null);
        }
        visitEnum(enum_) {
            enum_.type = Ast_1.OneAst.Type.Enum(enum_.name);
            super.visitEnum(enum_, null);
        }
        transform() {
            this.visitSchema(this.schemaCtx.schema, null);
        }
    }
    exports.InferTypesTransform = InferTypesTransform;
});
//# sourceMappingURL=InferTypesTransform.js.map