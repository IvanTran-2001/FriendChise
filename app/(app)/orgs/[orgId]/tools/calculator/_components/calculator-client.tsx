/**
 * Handles basic calculation.
 * Uses a stack to handle the maths equation.
 * Supports undoing the last character entered.
 */

"use client";

import { useCallback, useEffect } from "react";
import { Divide, X, Minus, Plus, Delete } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

type CalculatorState = {
  display: string;
  equation: string;
  isNewNumber: boolean;
  recentCalculations: string[];
};

type CalculatorClientProps = {
  orgId: string;
};

const INITIAL_STATE: CalculatorState = {
  display: "0",
  equation: "",
  isNewNumber: true,
  recentCalculations: [],
};

export function CalculatorClient({ orgId }: CalculatorClientProps) {
  const storageKey = `calculator-state-${orgId}`;
  const [state, setState] = usePersistedState<CalculatorState>(storageKey, INITIAL_STATE);

  const normalizedState = {
    ...INITIAL_STATE,
    ...state,
    recentCalculations: state.recentCalculations ?? [],
  } satisfies CalculatorState;

  const { display, equation, recentCalculations } = normalizedState;

  const updateState = useCallback(
    (updater: (prev: CalculatorState) => CalculatorState) => {
      setState((prev) => {
        const normalizedPrev = {
          ...INITIAL_STATE,
          ...prev,
          recentCalculations: prev.recentCalculations ?? [],
        } satisfies CalculatorState;

        return updater(normalizedPrev);
      });
    },
    [setState],
  );

  const handleNumber = useCallback((num: string) => {
    updateState((prev) => {
      if (num === "." && prev.display.includes(".") && !prev.isNewNumber) {
        return prev;
      }

      const nextDisplay = prev.isNewNumber
        ? num === "." ? "0." : num
        : prev.display === "0" && num !== "." ? num : prev.display + num;

      return {
        ...prev,
        display: nextDisplay,
        isNewNumber: false,
      };
    });
  }, [updateState]);

  const handleOperator = useCallback((op: string) => {
    updateState((prev) => {
      const nextEquation = prev.equation.trim().endsWith(")")
        ? prev.equation + op + " "
        : prev.equation + prev.display + " " + op + " ";

      return {
        ...prev,
        equation: nextEquation,
        isNewNumber: true,
      };
    });
  }, [updateState]);

  const handleBracket = useCallback((bracket: string) => {
    updateState((prev) => {
      let nextEquation = prev.equation;

      if (bracket === "(") {
        nextEquation = prev.equation + "( ";
      } else if (!prev.isNewNumber && !prev.equation.trim().endsWith(")")) {
        nextEquation = prev.equation + prev.display + " ) ";
      } else {
        nextEquation = prev.equation + ") ";
      }

      return {
        ...prev,
        equation: nextEquation,
        isNewNumber: true,
      };
    });
  }, [updateState]);

  const handleEqual = useCallback(() => {
    updateState((prev) => {
      try {
        let fullEquation = prev.equation;
        if (!prev.equation.trim().endsWith(")")) {
          fullEquation += prev.display;
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
            ops.pop();
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

        const result = values[0] ?? 0;
        if (!Number.isFinite(result)) {
          return {
            ...prev,
            display: "Error",
            equation: "",
            isNewNumber: true,
          };
        }

        const hasRealCalculation = prev.equation.trim().length > 0 || (prev.display !== "0" && !prev.isNewNumber);
        const nextRecentCalculations = hasRealCalculation
          ? [
              `${prev.equation ? prev.equation + prev.display : prev.display} = ${String(result)}`,
              ...prev.recentCalculations,
            ].slice(0, 6)
          : prev.recentCalculations;

        return {
          ...prev,
          display: String(result),
          equation: "",
          isNewNumber: true,
          recentCalculations: nextRecentCalculations,
        };
      } catch {
        return {
          ...prev,
          display: "Error",
          isNewNumber: true,
        };
      }
    });
  }, [updateState]);

  const handleClear = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      display: "0",
      equation: "",
      isNewNumber: true,
    }));
  }, [updateState]);

  const handleDelete = useCallback(() => {
    updateState((prev) => {
      if (prev.isNewNumber) {
        if (prev.equation.length > 0) {
          const parts = prev.equation.trim().split(" ");
          parts.pop();
          return {
            ...prev,
            equation: parts.length > 0 ? parts.join(" ") + " " : "",
          };
        }

        return prev;
      }

      if (prev.display.length > 1) {
        return {
          ...prev,
          display: prev.display.slice(0, -1),
        };
      }

      return {
        ...prev,
        display: "0",
        isNewNumber: true,
      };
    });
  }, [updateState]);

  const handleRemoveRecentCalculation = useCallback((entryToRemove: string) => {
    updateState((prev) => ({
      ...prev,
      recentCalculations: prev.recentCalculations.filter((entry) => entry !== entryToRemove),
    }));
  }, [updateState]);

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
  }, [handleBracket, handleClear, handleDelete, handleEqual, handleNumber, handleOperator]);

  const buttonClass = "flex items-center justify-center p-4 rounded-xl text-lg font-medium transition-colors hover:bg-muted active:scale-95 border border-border shadow-sm";
  const opButtonClass = "flex items-center justify-center p-4 rounded-xl text-lg font-medium transition-colors bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 active:scale-95 border border-indigo-500/20 shadow-sm dark:text-indigo-300";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-sm bg-card p-6 rounded-3xl shadow-sm border border-border">
        <div className="bg-muted/50 p-4 rounded-2xl mb-6 text-right">
          <div className="text-sm text-muted-foreground min-h-5 mb-1">
            {equation.replace(/\//g, "÷").replace(/\*/g, "×").replace(/\-/g, "−")}
          </div>
          <div className="text-4xl font-semibold tracking-tight truncate">{display}</div>
        </div>

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

        {recentCalculations.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-border/70 bg-background/70 p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Recent
            </div>
            <div className="space-y-1">
              {recentCalculations.map((entry, index) => (
                <div key={`${entry}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                  <span className="min-w-0 flex-1 break-words">{entry}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecentCalculation(entry)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Delete recent calculation ${entry}`}
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
