import { Form, FormControl, FormField, FormItem } from '@/components/ui/form'
import { RadioGroup } from '@/components/ui/radio-group'
import type { RadioGroupProps } from '@radix-ui/react-radio-group'
import type { PropsWithChildren } from 'react'
import {
  useForm,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'

export type FormRadioGroupProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
} & RadioGroupProps &
  PropsWithChildren

export default function FormRadioGroup<T extends FieldValues>({
  control,
  name,
  children,
  ...props
}: FormRadioGroupProps<T>) {
  const methods = useForm()

  return (
    <Form {...methods}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className="w-full">
            <FormControl>
              <RadioGroup
                defaultValue={field.value}
                onValueChange={field.onChange}
                {...props}
              >
                {children}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />
    </Form>
  )
}
