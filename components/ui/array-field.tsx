"use client";

import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/textarea";

interface ArrayFieldProps {
  title: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  addButtonText: string;
  className?: string;
  description?: string;
  required?: boolean;
  minItems?: number;
}

export function ArrayField({
  title,
  value,
  onChange,
  placeholder,
  addButtonText,
  className = "mb-6",
  description,
  required = false,
  minItems = 1,
}: ArrayFieldProps) {
  const addItem = () => {
    onChange([...value, ""]);
  };

  const removeItem = (index: number) => {
    // Prevent removal if it would go below minimum items
    if (value.length <= minItems) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, newValue: string) => {
    const newArray = [...value];
    newArray[index] = newValue;
    onChange(newArray);
  };

  return (
    <>
      <h4 className="font-semibold text-base md:text-lg mb-1">
        {title}
        {required && <span className="text-red-500 ml-1">*</span>}
      </h4>
      {description && (
        <p className="text-xs text-gray-600 mb-3 w-3/4">{description}</p>
      )}
      <div className={`${className} space-y-2`}>
        {value.map((item, index) => (
          <div key={index} className="flex space-x-2 items-center">
            <AutoGrowTextarea
              className="flex-1 border px-2 py-2 rounded resize-none overflow-hidden text-xs md:text-sm"
              value={item}
              onChange={e => updateItem(index, e.target.value)}
              placeholder={placeholder}
              rows={1}
              style={{
                height: "auto",
                minHeight: "40px",
              }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = target.scrollHeight + "px";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeItem(index)}
              disabled={value.length <= minItems}
              className={
                value.length <= minItems
                  ? "opacity-50 cursor-not-allowed text-xs md:text-sm"
                  : "text-xs md:text-sm"
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="flex justify-center mt-4">
          <Button
            type="button"
            className="text-xs md:text-sm items-center"
            size="sm"
            onClick={addItem}
          >
            {addButtonText}
          </Button>
        </div>
      </div>
    </>
  );
}
