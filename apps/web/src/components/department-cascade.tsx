'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export interface DeptNode {
  id: string;
  name: string;
  kind: string; // departament|sobe|bolme
  parentId: string | null;
}

interface DepartmentCascadeProps {
  departments: DeptNode[];
  /** Saved departmentId — the deepest chosen level. */
  value?: string | null;
  /** Emits the deepest selected level (bölmə > şöbə > departament) or undefined. */
  onChange: (departmentId: string | undefined) => void;
  disabled?: boolean;
}

/**
 * Cascading org-structure picker: Departament → Şöbə → Bölmə.
 * Levels are derived client-side from the flat /departments list via parentId.
 * Deeper levels are optional; changing a parent resets its children.
 */
export function DepartmentCascade({ departments, value, onChange, disabled }: DepartmentCascadeProps) {
  const byId = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  // Rebuild the selection chain (root → … → value) from the saved id.
  const chain = useMemo(() => {
    const ids: string[] = [];
    let cur = value ? byId.get(value) : undefined;
    while (cur) {
      ids.unshift(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return ids;
  }, [value, byId]);
  const chainKey = chain.join('|');

  const [l1, setL1] = useState(chain[0] ?? '');
  const [l2, setL2] = useState(chain[1] ?? '');
  const [l3, setL3] = useState(chain[2] ?? '');

  useEffect(() => {
    setL1(chain[0] ?? '');
    setL2(chain[1] ?? '');
    setL3(chain[2] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainKey]);

  const roots = departments.filter((d) => !d.parentId);
  const level2 = departments.filter((d) => l1 && d.parentId === l1);
  const level3 = departments.filter((d) => l2 && d.parentId === l2);

  const emit = (a: string, b: string, c: string) => onChange(c || b || a || undefined);

  return (
    <div className="space-y-3">
      <div>
        <Label>Departament</Label>
        <Select
          placeholder="Departament seçin"
          disabled={disabled}
          value={l1}
          onChange={(e) => {
            const v = e.target.value;
            setL1(v);
            setL2('');
            setL3('');
            emit(v, '', '');
          }}
          options={roots.map((d) => ({ value: d.id, label: d.name }))}
        />
      </div>
      {l1 && level2.length > 0 && (
        <div>
          <Label>Şöbə</Label>
          <Select
            placeholder="Şöbə seçin"
            disabled={disabled}
            value={l2}
            onChange={(e) => {
              const v = e.target.value;
              setL2(v);
              setL3('');
              emit(l1, v, '');
            }}
            options={level2.map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>
      )}
      {l2 && level3.length > 0 && (
        <div>
          <Label>Bölmə</Label>
          <Select
            placeholder="Bölmə seçin"
            disabled={disabled}
            value={l3}
            onChange={(e) => {
              const v = e.target.value;
              setL3(v);
              emit(l1, l2, v);
            }}
            options={level3.map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>
      )}
    </div>
  );
}
