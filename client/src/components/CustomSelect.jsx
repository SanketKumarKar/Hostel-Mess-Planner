import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({ value, onChange, options, placeholder = "Select an option", className = "", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative ${className}`} ref={selectRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2.5 bg-white border rounded-lg text-left flex items-center justify-between transition-all duration-200 outline-none
                    ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
                    ${isOpen && !disabled ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-gray-300 hover:border-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20'}
                `}
            >
                <span className={`block truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-800'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown 
                    size={16} 
                    className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} 
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1.5 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-scale-in origin-top">
                    <ul className="max-h-60 overflow-auto py-1 custom-scrollbar">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <li
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`px-3 py-2.5 mx-1 my-0.5 rounded-lg cursor-pointer flex items-center justify-between text-sm transition-colors
                                        ${isSelected 
                                            ? 'bg-primary/10 text-primary font-bold' 
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }
                                    `}
                                >
                                    <span className="block truncate">{option.label}</span>
                                    {isSelected && <Check size={14} className="text-primary" />}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
