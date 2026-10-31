// LoginForm Component
import InputField from './InputField'
import Button from './Button'

function LoginForm() {
    return (
        <div className="mx-auto p-6 w-full max-w-md">
            <div className="mb-8 text-center">
                <h1 className="mb-1 font-bold text-gray-900 dark:text-white text-2xl">
                    Welcome back
                </h1>

            </div>

            <form className="space-y-6">
                <InputField
                    id="email"
                    label="Your email"
                    type="email"
                    placeholder="name@company.com"
                    required
                />

                <InputField
                    id="password"
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    required
                />



                {/* Submit */}
                <Button type="submit" fullWidth>
                    Log in 
                </Button>

            </form>
        </div>
    )
}

export default LoginForm