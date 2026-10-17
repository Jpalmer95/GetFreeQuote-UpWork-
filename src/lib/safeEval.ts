/**
 * Tiny arithmetic evaluator for estimating-template formulas.
 * Accepts digits, + - * / ( ) . % and whitespace only. No identifiers, no Function().
 */
export function evaluateFormula(formula: string, vars: Record<string, number>, fallback: number): number {
    try {
        let expr = formula;
        for (const [key, val] of Object.entries(vars)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
            expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val));
        }
        if (!/^[\d+\-*/().%\s]+$/.test(expr)) return fallback;
        const result = evalArithmetic(expr);
        if (!Number.isFinite(result) || result < 0) return fallback;
        return result;
    } catch {
        return fallback;
    }
}

function evalArithmetic(input: string): number {
    const tokens = tokenize(input);
    let i = 0;

    function peek() { return tokens[i]; }
    function eat(t?: string) {
        if (t && tokens[i] !== t) throw new Error('unexpected');
        return tokens[i++];
    }

    function parseExpr(): number {
        let left = parseTerm();
        while (peek() === '+' || peek() === '-') {
            const op = eat();
            const right = parseTerm();
            left = op === '+' ? left + right : left - right;
        }
        return left;
    }

    function parseTerm(): number {
        let left = parseUnary();
        while (peek() === '*' || peek() === '/' || peek() === '%') {
            const op = eat();
            const right = parseUnary();
            if (op === '*') left *= right;
            else if (op === '/') left = right === 0 ? NaN : left / right;
            else left = right === 0 ? NaN : left % right;
        }
        return left;
    }

    function parseUnary(): number {
        if (peek() === '-') { eat(); return -parseUnary(); }
        if (peek() === '+') { eat(); return parseUnary(); }
        return parsePrimary();
    }

    function parsePrimary(): number {
        const t = peek();
        if (t === '(') {
            eat('(');
            const v = parseExpr();
            eat(')');
            return v;
        }
        if (t === undefined || Number.isNaN(Number(t))) throw new Error('number expected');
        eat();
        return Number(t);
    }

    const value = parseExpr();
    if (i !== tokens.length) throw new Error('trailing tokens');
    return value;
}

function tokenize(s: string): string[] {
    const out: string[] = [];
    const re = /\s+|(\d+(?:\.\d+)?)|([+\-*/()%])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
        if (m[1]) out.push(m[1]);
        else if (m[2]) out.push(m[2]);
    }
    return out;
}

export function sanitizeIlike(value: string, max = 80): string {
    return value.replace(/[%_,.()\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
