import React from 'react'

interface InputFieldProps {
    id: string
    label: string
    type: 'email' | 'password' | 'text'
    placeholder: string
    required?: boolean
}

function InputField({ id, label, type, placeholder, required = false }: InputFieldProps) {
    return (
        <div>
            <label
                htmlFor={id}
                className="block mb-2 font-medium text-gray-900 dark:text-white text-sm"
            >
                {label}
            </label>
            <input
                type={type}
                id={id}
                className="block bg-gray-50 dark:bg-gray-700 p-2.5 border border-gray-300 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500 rounded-lg focus:ring-blue-500 dark:focus:ring-blue-500 w-full text-gray-900 dark:text-white text-sm dark:placeholder-gray-400"
                placeholder={placeholder}
                required={required}
            />
        </div>
    )
}

export default InputField