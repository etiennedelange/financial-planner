#!/usr/bin/env bash

input=$(cat)

# ── Data ───────────────────────────────────────────────────────────────
model=$(jq -r '.model.display_name // "Claude"' <<< "$input")
cwd=$(jq -r '.workspace.current_dir // ""' <<< "$input")
branch=$(jq -r '.git.branch // empty' <<< "$input")
dirty=$(jq -r '.git.is_dirty // false' <<< "$input")
context=$(jq -r '.context_window.used_percentage // 0' <<< "$input")
cost=$(jq -r '.cost.total_cost_usd // empty' <<< "$input")

# ── Colours ────────────────────────────────────────────────────────────
reset='\033[0m'
dim='\033[2m'
bold='\033[1m'
cyan='\033[36m'
blue='\033[34m'
green='\033[32m'
yellow='\033[33m'
red='\033[31m'
white='\033[97m'

# ── Directory ──────────────────────────────────────────────────────────
dir="${cwd/#$HOME/~}"

# ── Context bar ────────────────────────────────────────────────────────
bar_width=10
filled=$(awk "BEGIN { printf \"%d\", ($context / 100) * $bar_width }")

bar=""
for ((i=0; i<bar_width; i++)); do
    if (( i < filled )); then
        bar+="█"
    else
        bar+="░"
    fi
done

if (( $(awk "BEGIN { print ($context >= 80) }") )); then
    context_color="$red"
elif (( $(awk "BEGIN { print ($context >= 60) }") )); then
    context_color="$yellow"
else
    context_color="$green"
fi

# ── Git ────────────────────────────────────────────────────────────────
git_info=""

if [[ -n "$branch" ]]; then
    if [[ "$dirty" == "true" ]]; then
        git_info="${blue}⎇${reset} ${white}${branch}${reset}${yellow}*${reset}"
    else
        git_info="${blue}⎇${reset} ${white}${branch}${reset}"
    fi
fi

# ── Cost ───────────────────────────────────────────────────────────────
cost_info=""

if [[ -n "$cost" && "$cost" != "null" ]]; then
    cost_info="${dim}\$${cost}${reset}"
fi

# ── Output ─────────────────────────────────────────────────────────────
printf "${cyan}${bold}◆${reset} ${white}${bold}%s${reset}  ${dim}%s${reset}" \
    "$model" "$dir"

if [[ -n "$git_info" ]]; then
    printf "  ${dim}│${reset}  %b" "$git_info"
fi

printf "  ${dim}│${reset}  ${context_color}%s${reset} ${dim}%3.0f%%${reset}" \
    "$bar" "$context"

if [[ -n "$cost_info" ]]; then
    printf "  ${dim}│${reset}  %b" "$cost_info"
fi

printf "\n"
