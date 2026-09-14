'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getCompanies } from '@/app/actions/companies';
import type { Company } from '@/types/companies';

/**
 * Company combobox — gõ để tìm công ty theo tên, chọn từ dropdown thay vì
 * gõ tay UUID (JobForm.tsx trước đây có ô text company_id trần, TODO
 * "Replace with autocomplete" treo từ đợt viết form React ban đầu).
 * Matches Flask: templates/_company_combobox.html + public/app.js
 * (initCompanyCombobox) — đối chiếu kỹ hành vi gốc trước khi viết (audit
 * 09/2026, đợt "ưu tiên thấp"):
 *
 * - Dùng đúng bộ CSS class có sẵn trong public/css/07-forms.css
 *   (.cbx/.cbx-input/.cbx-panel/.cbx-list/.cbx-opt/.cbx-opt-sub/
 *   .cbx-empty/.cbx-error) — CSS đã tồn tại từ trước (comment "Company
 *   combobox (search + scroll)") nhưng chưa component nào dùng tới,
 *   KHÔNG tự bịa class mới.
 * - Reset input về nhãn đã chọn (hoặc rỗng) khi click ra ngoài mà chưa
 *   chọn gì mới — khớp đúng handler `document.addEventListener('click', ...)`
 *   trong app.js gốc, tránh lệch giữa chữ hiển thị và company_id thật
 *   gửi lên form.
 * - KHÔNG dùng HTML5 `required` trên hidden input (không có tác dụng) —
 *   chặn submit ở cấp form qua `validate()` lộ ra ngoài bằng ref, gọi
 *   từ JobForm.tsx::handleSubmit trước khi build payload, giống cách
 *   app.js gốc chặn ở submit listener cấp form (`document.addEventListener
 *   ('submit', ...)`), không phải cấp input.
 *
 * KHÁC bản gốc (chủ ý, không phải sai lệch): Flask preload toàn bộ danh
 * sách công ty 1 lần rồi filter client-side (mọi trang gọi include này
 * đã có sẵn `companies` truyền vào template). Next.js không preload cả
 * bảng company vào page — search server-side qua Server Action
 * `getCompanies({ keyword })` (actions/companies.ts, đã có sẵn, đúng là
 * filter theo tên) mỗi lần gõ (debounce ~300ms), hiệu quả hơn với danh
 * sách công ty lớn dần theo thời gian và không cần đổi kiến trúc trang
 * cha để preload thêm.
 *
 * KHÔNG làm trong phạm vi task này: nút "＋ Tạo công ty mới…" (.cbx-opt-new,
 * `allow_new` bên Flask gốc) — mở rộng phạm vi ngoài "autocomplete chọn
 * công ty có sẵn", cần route/luồng tạo company riêng để test kỹ, không
 * làm ẩu kèm theo đây.
 */

export interface CompanyComboboxHandle {
  /** Trả về true nếu hợp lệ (không required, hoặc đã chọn công ty). Set
   * lỗi hiển thị nếu không hợp lệ — gọi trước khi submit form. */
  validate: () => boolean;
}

interface CompanyComboboxProps {
  id: string;
  /** Tên field hidden thật gửi lên server (mặc định "company_id"). */
  name?: string;
  required?: boolean;
  /** company_id đã chọn sẵn (chế độ edit). */
  initialValue?: string;
  /** company_name hiển thị sẵn tương ứng initialValue (chế độ edit). */
  initialLabel?: string;
  ref?: React.Ref<CompanyComboboxHandle>;
}

export default function CompanyCombobox({
  id,
  name = 'company_id',
  required = true,
  initialValue = '',
  initialLabel = '',
  ref,
}: CompanyComboboxProps) {
  const t = useTranslations('companyCombobox');

  const [inputValue, setInputValue] = useState(initialLabel);
  const [selectedId, setSelectedId] = useState(initialValue);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel);
  const [hasQuery, setHasQuery] = useState(false);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Company[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [errorVisible, setErrorVisible] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Đánh dấu request search mới nhất — bỏ qua response cũ về trễ (race
  // condition khi gõ nhanh, response của keyword cũ về sau keyword mới).
  const latestRequestRef = useRef(0);

  // Lộ validate() ra ngoài qua ref (React 19: ref là prop bình thường,
  // không cần forwardRef) — JobForm.tsx gọi trước khi submit vì hidden
  // input không tự validate HTML5 "required" như <select> cũ.
  useImperativeHandle(ref, () => ({
    validate: () => {
      const ok = !required || Boolean(selectedId);
      setErrorVisible(!ok);
      return ok;
    },
  }), [required, selectedId]);

  const runSearch = useCallback((keyword: string) => {
    const requestId = ++latestRequestRef.current;
    getCompanies({ keyword: keyword || undefined, limit: 8 }).then((result) => {
      if (requestId !== latestRequestRef.current) return;
      setOptions(result.items);
    }).catch(() => {
      if (requestId !== latestRequestRef.current) return;
      setOptions([]);
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Chưa gõ (vừa mở panel, kể cả khi input đã có sẵn tên công ty do
    // chọn từ trước) -> load ngay danh sách mặc định, không cần debounce.
    const keyword = hasQuery ? inputValue.trim() : '';
    const delay = hasQuery ? 300 : 0;
    debounceRef.current = setTimeout(() => runSearch(keyword), delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, hasQuery, inputValue, runSearch]);

  useEffect(() => {
    function handleDocumentMouseDown(e: MouseEvent) {
      if (!containerRef.current || containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
      setActiveIndex(-1);
      // Click ra ngoài mà chưa chọn gì mới: trả input về đúng nhãn đã
      // chọn trước đó (hoặc rỗng) — không giữ chữ gõ dở, tránh lệch với
      // hidden input thật sự gửi lên form.
      setInputValue(selectedLabel);
      setHasQuery(false);
    }
    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [selectedLabel]);

  const selectCompany = (company: Company) => {
    setSelectedId(company.company_id);
    setSelectedLabel(company.company_name);
    setInputValue(company.company_name);
    setHasQuery(false);
    setErrorVisible(false);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleFocus = () => {
    setOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setHasQuery(true);
    setSelectedId('');
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (!options.length) return;
      setActiveIndex((prev) => {
        if (e.key === 'ArrowDown') return Math.min(prev + 1, options.length - 1);
        return Math.max(prev - 1, 0);
      });
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && options[activeIndex]) {
        e.preventDefault();
        selectCompany(options[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const showEmpty = hasQuery && options.length === 0;
  const panelId = `${id}_panel`;

  return (
    <div className={`cbx${open ? ' cbx-open' : ''}`} ref={containerRef}>
      <input
        type="text"
        className="cbx-input"
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={t('placeholder')}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={panelId}
        aria-autocomplete="list"
      />
      {/* Field thật gửi lên server — text input ở trên chỉ để gõ-tìm/
          hiển thị, KHÔNG có attribute "name". */}
      <input type="hidden" name={name} value={selectedId} />
      {open && (
        <div className="cbx-panel" id={panelId}>
          <ul className="cbx-list" role="listbox">
            {options.map((company, idx) => (
              <li
                key={company.company_id}
                role="option"
                aria-selected={idx === activeIndex}
                className={`cbx-opt${idx === activeIndex ? ' cbx-active' : ''}`}
                // mousedown thay vì onClick: chạy TRƯỚC blur của input,
                // dùng onClick thì blur đóng panel mất trước khi kịp chọn.
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCompany(company);
                }}
              >
                {company.company_name}
                {company.province_name && (
                  <span className="cbx-opt-sub"> ({company.province_name})</span>
                )}
              </li>
            ))}
          </ul>
          {showEmpty && <p className="cbx-empty">{t('emptyMessage')}</p>}
        </div>
      )}
      {errorVisible && <p className="cbx-error">{t('errorRequired')}</p>}
    </div>
  );
}
