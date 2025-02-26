import { useState, useEffect } from "react";
import { Decimal } from "decimal.js";
import { ValueRegistry } from "../base/ValueRegistry";
import { ConstantValue, ResourceValue } from "../base/Value";
import React from "react";

export default function Home() {
  const [registry] = useState(() => {
    const registry = new ValueRegistry();

    // Add some example values
    const gold = registry.addResource("gold", "1"); // 1 gold per second
    const gems = registry.addResource("gems", "gold / 10"); // 0.1 gems per second
    const power = registry.addResource("power", "gems * 2"); // Power increases with gems

    return registry;
  });

  const [values, setValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      registry.update(0.1); // Update every 100ms

      // Update displayed values
      const newValues: { [key: string]: string } = {};
      for (const [key, value] of registry.Values) {
        newValues[key] = value.getValue(registry).toString();
      }
      setValues(newValues);
    }, 100);

    return () => clearInterval(interval);
  }, [registry]);

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-2xl font-bold mb-4">Resource Values</h2>
                {Object.entries(values).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="font-medium">{key}:</span>
                    <span className="text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
