import React, { useEffect, useRef } from "react";
import classNames from "classnames";
import { createPortal } from "react-dom";

export type AutocompleteMatchesOptions = {
  minLeft: number;
};

function Match({
  label,
  isSelected,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  onClick: (match: string) => void;
}) {
  const buttonNode = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isSelected) {
      buttonNode.current?.scrollIntoView({ block: "nearest", inline: "end" });
    }
  }, [isSelected]);

  return (
    <button
      className={classNames(
        "w-full cursor-default px-1 text-left",
        isSelected ? "bg-primaryAccent text-white" : "hover:bg-toolbarBackgroundAlt"
      )}
      ref={buttonNode}
      onClick={() => onClick(label)}
    >
      {label}
    </button>
  );
}

export default function AutocompleteMatches({
  containerRect,
  leftOffset,
  matches,
  selectedIndex,
  onMatchClick,
  options,
}: {
  options: AutocompleteMatchesOptions;
  containerRect: DOMRect;
  leftOffset: number;
  matches: string[];
  selectedIndex: number;
  onMatchClick: (match: string) => void;
}) {
  const { top, left } = containerRect;

  return createPortal(
    <div className="absolute z-10 -translate-y-full transform" style={{ top, left }}>
      <div
        className="autocomplete-matches flex flex-col overflow-y-auto overflow-x-hidden border border-splitter bg-menuBgcolor py-1 font-mono text-menuColor shadow-sm"
        style={{
          fontSize: "var(--theme-code-font-size)",
          marginLeft: `max(${options.minLeft}px, ${leftOffset}ch)`,
          maxHeight: "160px",
          maxWidth: "200px",
          minWidth: "160px",
        }}
      >
        {matches.map((match, i) => (
          <Match label={match} isSelected={i === selectedIndex} key={i} onClick={onMatchClick} />
        ))}
      </div>
    </div>,
    document.body
  );
}