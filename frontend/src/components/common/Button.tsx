import React from 'react'

interface ButtonProps {
    type?: 'button' | 'submit' | 'reset'
    children: React.ReactNode
    fullWidth?: boolean
    onClick?: () => void
}

function Button({ type = 'button', children, fullWidth = false, onClick }: ButtonProps) {
    return (
        <button
            type={type}
            onClick={onClick}
            className={`bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 px-5 py-2.5 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 font-medium text-white text-sm ${
                fullWidth ? 'w-full' : ''
            }`}
        >
            {children}
        </button>
    )
}

export default Button