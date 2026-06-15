export const APP_NAME = "Talkativity"

export function AppLogo({ className = "", size = 32, alt = APP_NAME }) {
    return(
        <img 
            src="/logo.png"
            alt={alt}
            width={size}
            height={size}
            className={`shrink-0 object-contain select-one ${className}`}
            draggable="false"
        />
    )
}