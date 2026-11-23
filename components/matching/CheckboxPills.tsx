/**
 * A row of tick-box pills (levels, teaching styles, goals…), used by the
 * admin matching form and the tutor's own profile form.
 * (Moved here from app/admin/tutors/MatchingProfileForm.tsx so both can share it.)
 */
import matching from "./matching.module.css";

export function CheckboxPills({ name, options, checked }: { name: string; options: readonly { value: string; label: string }[]; checked: string[] }) {
  return (
    <div className={matching.pills}>
      {options.map((option) => (
        <label key={option.value} className={matching.pill}>
          <input type="checkbox" name={name} value={option.value} defaultChecked={checked.includes(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  );
}
