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
    function arrayEq(a, b) {
        if (a === b)
            return true;
        if (a == null || b == null || a.length != b.length)
            return false;
        for (var i = 0; i < a.length; ++i)
            if (a[i] !== b[i])
                return false;
        return true;
    }
    exports.arrayEq = arrayEq;
});
//# sourceMappingURL=Helpers.js.map