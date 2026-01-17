/**
 * Экспорт модуля ввода
 */

export {
    type JoystickState,
    type JoystickConfig,
    createJoystickState,
    createJoystickConfig,
    resetJoystick,
    updateJoystickFromPointer,
    createJoystickElements,
    updateJoystickVisual,
    setJoystickVisible,
    updateJoystickSize,
} from "./joystick";

export {
    InputManager,
    type MouseState,
    type InputManagerDeps,
    type InputCallbacks,
} from "./InputManager";
