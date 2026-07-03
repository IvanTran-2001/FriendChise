/** 
* Handles basic calculation.
* Uses a stack to handle the maths equation.
* Supports undoing the last character entered.
*/

"use client";

import { useState, useEffect } from "react";
import { Divide, X, Minus, Plus, Delete } from "lucide-react";

export function CalculatorClient() {
  const [display, setDisplay] = useState("0");
  const [equation, setEquation] = useState("");
  const [isNewNumber, setIsNewNumber] = useState(true);

  const handleNumber = (num: string) => {
    if (num === "." && display.includes(".") && !isNewNumber) return;

    if (isNewNumber) {
      setDisplay(num === "." ? "0." : num);
      setIsNewNumber(false);
    } else {
      setDisplay(display === "0" && num !== "." ? num : display + num);
    }
  };

  const handleOperator = (op: string) => {
    if (equation.trim().endsWith(")")) {
      setEquation(equation + op + " ");
    } else {
      setEquation(equation + display + " " + op + " ");
    }
    setIsNewNumber(true);
  };

  const handleBracket = (bracket: string) => {
    if (bracket === "(") {
      setEquation(equation + "( ");
    } else {
      if (!isNewNumber && !equation.trim().endsWith(")")) {
        setEquation(equation + display + " ) ");
      } else {
        setEquation(equation + ") ");
      }
    }
    setIsNewNumber(true);
  };

  const handleEqual = () => {
    try {
      let fullEquation = equation;
      if (!equation.trim().endsWith(")")) {
        fullEquation += display;
      }
      const tokens = fullEquation.split(" ").filter(Boolean);
      
      const values: number[] = [];
      const ops: string[] = [];
      
      const precedence = (op: string) => {
        if (op === "+" || op === "-") return 1;
        if (op === "*" || op === "/") return 2;
        return 0;
      };
      
      const applyOp = (a: number, b: number, op: string) => {
        const numA = a ?? 0;
        const numB = b ?? 0;
        switch (op) {
          case "+": return numA + numB;
          case "-": return numA - numB;
          case "*": return numA * numB;
          case "/": return numA / numB;
        }
        return 0;
      };

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === "(") {
          ops.push(token);
        } else if (token === ")") {
          while (ops.length > 0 && ops[ops.length - 1] !== "(") {
            const b = values.pop()!;
            const a = values.pop()!;
            const op = ops.pop()!;
            values.push(applyOp(a, b, op));
          }
          ops.pop(); // Pop '('
        } else if (token === "+" || token === "-" || token === "*" || token === "/") {
          while (ops.length > 0 && precedence(ops[ops.length - 1]) >= precedence(token)) {
            const b = values.pop()!;
            const a = values.pop()!;
            const op = ops.pop()!;
            values.push(applyOp(a, b, op));
          }
          ops.push(token);
        } else {
          values.push(parseFloat(token));
        }
      }

      while (ops.length > 0) {
        const b = values.pop()!;
        const a = values.pop()!;
        const op = ops.pop()!;
        values.push(applyOp(a, b, op));
      }

      setDisplay(String(values[0] ?? 0));
      setEquation("");
      setIsNewNumber(true);
    } catch (e) {
      setDisplay("Error");
      setIsNewNumber(true);
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setEquation("");
    setIsNewNumber(true);
  };

  const handleDelete = () => {
    if (isNewNumber) {
      if (equation.length > 0) {
        const parts = equation.trim().split(" ");
        parts.pop();
        setEquation(parts.length > 0 ? parts.join(" ") + " " : "");
      }
    } else {
      if (display.length > 1) {
        setDisplay(display.slice(0, -1));
      } else {
        setDisplay("0");
        setIsNewNumber(true);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      const key = e.key;
      if (/[0-9.]/.test(key)) {
        e.preventDefault();
        handleNumber(key);
      } else if (key === "+" || key === "-" || key === "*" || key === "/") {
        e.preventDefault();
        handleOperator(key);
      } else if (key === "x" || key === "X") {
        e.preventDefault();
        handleOperator("*");
      } else if (key === "Enter" || key === "=") {
        e.preventDefault();
        handleEqual();
      } else if (key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (key === "Escape") {
        e.preventDefault();
        handleClear();
      } else if (key === "(" || key === ")") {
        e.preventDefault();
        handleBracket(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [display, equation, isNewNumber]);

  const buttonClass = "flex items-center justify-center p-4 rounded-xl text-lg font-medium transition-colors hover:bg-muted active:scale-95 border border-border shadow-sm";
  const opButtonClass = "flex items-center justify-center p-4 rounded-xl text-lg font-medium transition-colors bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 active:scale-95 border border-indigo-500/20 shadow-sm dark:text-indigo-300";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-sm bg-card p-6 rounded-3xl shadow-sm border border-border">
        {/* Display */}
        <div className="bg-muted/50 p-4 rounded-2xl mb-6 text-right">
          <div className="text-sm text-muted-foreground min-h-5 mb-1">
            {equation.replace(/\//g, "÷").replace(/\*/g, "×").replace(/\-/g, "−")}
          </div>
          <div className="text-4xl font-semibold tracking-tight truncate">{display}</div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-3">
          <button onClick={handleClear} className={`${buttonClass} text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20`}>C</button>
          <button onClick={() => handleBracket("(")} className={buttonClass}>(</button>
          <button onClick={() => handleBracket(")")} className={buttonClass}>)</button>
          <button onClick={handleDelete} className={`${buttonClass} text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20`}><Delete className="w-5 h-5" /></button>

          <button onClick={() => handleNumber("7")} className={buttonClass}>7</button>
          <button onClick={() => handleNumber("8")} className={buttonClass}>8</button>
          <button onClick={() => handleNumber("9")} className={buttonClass}>9</button>
          <button onClick={() => handleOperator("/")} className={opButtonClass}><Divide className="w-5 h-5" /></button>

          <button onClick={() => handleNumber("4")} className={buttonClass}>4</button>
          <button onClick={() => handleNumber("5")} className={buttonClass}>5</button>
          <button onClick={() => handleNumber("6")} className={buttonClass}>6</button>
          <button onClick={() => handleOperator("*")} className={opButtonClass}><X className="w-5 h-5" /></button>

          <button onClick={() => handleNumber("1")} className={buttonClass}>1</button>
          <button onClick={() => handleNumber("2")} className={buttonClass}>2</button>
          <button onClick={() => handleNumber("3")} className={buttonClass}>3</button>
          <button onClick={() => handleOperator("-")} className={opButtonClass}><Minus className="w-5 h-5" /></button>

          <button onClick={() => handleNumber("0")} className={buttonClass}>0</button>
          <button onClick={() => handleNumber(".")} className={buttonClass}>.</button>
          <button onClick={handleEqual} className={`${opButtonClass} bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white dark:text-white`}>=</button>
          <button onClick={() => handleOperator("+")} className={opButtonClass}><Plus className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}
