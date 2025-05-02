// calculator.js
import { derivative, evaluate, parse, simplify } from "mathjs";
import Algebrite from "algebrite";

export function getDerivative(expr, variable) {
  try {
    expr = expr.replace("d/dx", "").trim();
    const rawDeriv = derivative(expr, variable);
    const simplified = simplify(rawDeriv);
    const latex = simplified.toTex({ parenthesis: "keep", implicit: "hide" });
    const plainExpr = simplified.toString(); 

    return { latex, expression: plainExpr };
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

export function getIntegral(expr, variable, lower = null, upper = null) {
  try {
    if (lower !== null && upper !== null) {
      const f = (x) => evaluate(expr, { [variable]: x });
      let sum = 0;
      const n = 10000;
      const dx = (upper - lower) / n;
      for (let i = 1; i < n; i++) sum += f(lower + i * dx);
      sum += (f(lower) + f(upper)) / 2;
      sum *= dx;
      return sum.toFixed(6);
    } else {
      const indefiniteString = Algebrite.integral(expr).toString();
      const indefiniteNode = parse(indefiniteString);
      const simplified = simplify(indefiniteNode);
      const latex = simplified.toTex({ parenthesis: "keep", implicit: "hide" });
      const plainExpr = simplified.toString();

      return { latex, expression: plainExpr };
    }
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

export function evaluateExpression(expr) {
  try {
    const numericValue = evaluate(expr, { x: 1 });
    const node = parse(expr);
    const simplified = simplify(node);
    const latex = simplified.toTex({ parenthesis: "keep", implicit: "hide" });
    const plainExpr = simplified.toString();

    return { latex, expression: plainExpr };
  } catch (error) {
    return `Error: ${error.message}`;
  }
}
