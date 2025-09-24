// inspired by https://css-tricks.com/creating-an-editable-textarea-that-supports-syntax-highlighted-code/

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Autocomplete, AutocompleteItem, Input, Select, SelectItem } from "@heroui/react"

import { autoCompleteOverrides, inputOverrides, selectOverrides, tst } from "../utils/overrides.js"
import { useHLJS, highlightHTML } from "../utils/HighlightLoader.js"

import "../styles/highlight-theme-light.css"
import "../styles/highlight-theme-dark.css"

// TODO:
// - line number
// - clear button
interface CodeInputProps extends React.HTMLProps<HTMLDivElement> {
  content: string
  setContent: (code: string) => void
  lang?: string
  setLang: (lang?: string) => void
  filename?: string
  setFilename: (filename?: string) => void
  placeholder?: string
  disabled?: boolean
}

interface TabSetting {
  char: "tab" | "space"
  width: 2 | 4 | 8
}

function formatTabSetting(s: TabSetting, forHuman: boolean) {
  if (forHuman) {
    return s.char === "tab" ? `Tab: ${s.width}` : `Spaces: ${s.width}`
  }
  return `${s.char} ${s.width}`
}

function parseTabSetting(s: string): TabSetting | undefined {
  const match = s.match(/^(tab|space) ([248])$/)
  if (!match) return undefined
  return { char: match[1] as TabSetting["char"], width: parseInt(match[2]) as TabSetting["width"] }
}

const TAB_CHOICES: TabSetting[] = [
  { char: "tab", width: 2 },
  { char: "tab", width: 4 },
  { char: "tab", width: 8 },
  { char: "space", width: 2 },
  { char: "space", width: 4 },
  { char: "space", width: 8 },
]

function handleNewLines(str: string): string {
  if (str.at(-1) === "\n") str += " "
  return str
}

export function CodeEditor({
  content,
  setContent,
  lang,
  setLang,
  filename,
  setFilename,
  placeholder,
  disabled,
  className,
  ...rest
}: CodeInputProps) {
  const refHighlighting = useRef<HTMLPreElement | null>(null)
  const refTextarea = useRef<HTMLTextAreaElement | null>(null)
  const refLineNumbers = useRef<HTMLSpanElement | null>(null)

  const [heightPx, setHeightPx] = useState<number>(0)
  const hljs = useHLJS()

  // ===== DEFAULTS =====
  const LANG_DEFAULT = "cpp"
  const TAB_DEFAULT: TabSetting = { char: "tab", width: 4 }

  // Indent default
  const [tabSetting, setTabSettings] = useState<TabSetting>(TAB_DEFAULT)

  // Số dòng (để vẽ cột số dòng)
  const lineCount = (content?.match(/\n/g)?.length || 0) + 1

  // Danh sách ngôn ngữ cho Autocomplete: luôn có 'cpp' để tránh rỗng
  const allLangs = useMemo(() => (hljs ? hljs.listLanguages() : []), [hljs])
  const langItems = useMemo(() => {
    const hasCpp = allLangs.includes(LANG_DEFAULT)
    const list = hasCpp ? allLangs : [LANG_DEFAULT, ...allLangs]
    // map về { key } như props yêu cầu
    return list.map((k) => ({ key: k }))
  }, [allLangs])

  // Khi mount / khi hljs sẵn sàng: nếu lang chưa set hoặc không hợp lệ -> ép về 'cpp'
  useEffect(() => {
    if (!lang || !allLangs.includes(lang)) {
      setLang(LANG_DEFAULT)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hljs]) // chạy lại khi hljs load xong

  function syncScroll() {
    refHighlighting.current!.scrollLeft = refTextarea.current!.scrollLeft
    refHighlighting.current!.scrollTop = refTextarea.current!.scrollTop
    if (refLineNumbers.current) {
      refLineNumbers.current.scrollTop = refTextarea.current!.scrollTop
    }
  }

  function handleInput(_: React.FormEvent<HTMLTextAreaElement>) {
    const editing = refTextarea.current!
    setContent(editing.value)
    syncScroll()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const element = refTextarea.current!
    if (event.key === "Tab") {
      event.preventDefault()
      const before = content.slice(0, element.selectionStart)
      const after = content.slice(element.selectionEnd)
      const insert = tabSetting.char === "tab" ? "\t" : " ".repeat(tabSetting.width)
      const pos = element.selectionStart + insert.length
      setContent(before + insert + after)
      element.selectionStart = pos
      element.selectionEnd = pos
    } else if (event.key === "Escape") {
      element.blur()
    }
  }

  useEffect(() => {
    setHeightPx(refTextarea.current!.clientHeight)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) setHeightPx(entry.contentRect.height)
      }
    })
    observer.observe(refTextarea.current!)
    return () => observer.disconnect()
  }, [])

  const lineNumOffset = `${Math.floor(Math.log10(lineCount)) + 3}ch`

  // selectedLang luôn hợp lệ (rơi về cpp nếu undefined/invalid)
  const selectedLang = allLangs.includes(lang || "") ? (lang as string) : LANG_DEFAULT

  return (
    <div className={className} {...rest}>
      <div className={"mb-2 gap-2 flex flex-row"}>
        <Input
          classNames={inputOverrides}
          type="text"
          label="File name"
          size="sm"
          value={filename || ""}
          onValueChange={setFilename}
        />

        {/* LANGUAGE */}
        <Autocomplete
          className="max-w-[10em]"
          classNames={autoCompleteOverrides}
          label="Language"
          size="sm"
          defaultItems={langItems}
          defaultSelectedKey={LANG_DEFAULT}
          // Controlled: luôn có giá trị hợp lệ
          selectedKey={selectedLang}
          onSelectionChange={(key) => {
            const v = (key as string) || LANG_DEFAULT
            setLang(v)
          }}
        >
          {(language) => <AutocompleteItem key={language.key}>{language.key}</AutocompleteItem>}
        </Autocomplete>

        {/* INDENT */}
        <Select
          size="sm"
          label="Indent With"
          className="max-w-[10em] text-foreground"
          classNames={selectOverrides}
          selectedKeys={[formatTabSetting(tabSetting, false)]}
          defaultSelectedKeys={[formatTabSetting(TAB_DEFAULT, false)]}
          onSelectionChange={(s) => {
            const next = parseTabSetting((s as any).currentKey || "")
            setTabSettings(next ?? TAB_DEFAULT)
          }}
        >
          {TAB_CHOICES.map((s) => (
            <SelectItem key={formatTabSetting(s, false)}>{formatTabSetting(s, true)}</SelectItem>
          ))}
        </Select>
      </div>

      <div className={`w-full bg-default-100 ${tst} rounded-xl p-2 relative`}>
        <div className="relative w-full" style={{ tabSize: tabSetting.char === "tab" ? tabSetting.width : undefined }}>
          <div className="w-full font-mono top-0 left-0 absolute">
            <pre
              ref={refHighlighting}
              className={`text-foreground ${tst} w-full overflow-x-hidden`}
              style={{ marginLeft: lineNumOffset, width: `calc(100% - ${lineNumOffset})`, height: `${heightPx}px` }}
              dangerouslySetInnerHTML={{
                __html: highlightHTML(hljs, selectedLang, handleNewLines(content)),
              }}
            ></pre>
            <span
              ref={refLineNumbers}
              className={
                "line-number-rows font-mono absolute pointer-events-none text-default-500 top-0 left-1 overflow-hidden " +
                `border-solid border-default-300 border-r-1 ${tst}`
              }
              style={{ height: `${heightPx}px` }}
            >
              {Array.from({ length: lineCount }, (_, idx) => (
                <span key={idx} />
              ))}
            </span>
          </div>

          <textarea
            className={`w-full font-mono min-h-[20em] text-transparent placeholder-default-400 
             caret-foreground bg-transparent outline-none relative overflow-x-auto`}
            style={{ marginLeft: lineNumOffset, width: `calc(100% - ${lineNumOffset})` }}
            wrap="off"
            ref={refTextarea}
            readOnly={disabled}
            placeholder={placeholder}
            onScroll={syncScroll}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            value={content}
            spellCheck={false}
            aria-label="Paste editor"
          ></textarea>
        </div>
      </div>
    </div>
  )
}
