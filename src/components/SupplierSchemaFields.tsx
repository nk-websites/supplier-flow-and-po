import { Field, Input } from "@/components/ui/Input";
import type { CountrySchemaField } from "@/types";

export function SchemaFields({
  fields,
  values,
  onChange,
  errors,
  errorPrefix,
}: {
  fields: CountrySchemaField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
  errorPrefix?: string;
}) {
  if (!fields.length) {
    return <p className="text-[13px] text-muted-foreground">No fields configured for this country.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          required={f.required}
          error={errors && errorPrefix ? errors[`${errorPrefix}.${f.key}`] : undefined}
        >
          <Input
            value={values[f.key] ?? ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={f.placeholder}
          />
        </Field>
      ))}
    </div>
  );
}
