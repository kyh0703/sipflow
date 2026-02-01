import {
  useForm,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField } from '@/components/ui/form'

export type FormInputProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  maxLength?: number
} & React.InputHTMLAttributes<HTMLInputElement>

export default function FormInput<T extends FieldValues>({
  control,
  name,
  ...props
}: FormInputProps<T>) {
  const form = useForm()

  return (
    <Form {...form}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormControl>
            <Input
              {...field}
              {...props}
              onChange={(event) =>
                field.onChange(
                  props.type === 'number'
                    ? Number(event.target.value)
                    : event.target.value,
                )
              }
            />
          </FormControl>
        )}
      />
    </Form>
  )
}
