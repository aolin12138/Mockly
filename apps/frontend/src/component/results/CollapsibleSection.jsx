import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Card from './Card';

export default function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false, delay = 0 }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card delay={delay}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-emerald-700" />}
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500" />
        )}
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="pt-4">{children}</div>
      </motion.div>
    </Card>
  );
}
