function extractLPModel(model) {
    const maxZ = [];
    const values = [];

    const lines = model.split("\n").map(line => line.trim()).filter(line => line);
    lines.forEach(line => {
        if(line.startsWith("Max z = ") || line.startsWith("max z = ") || line.startsWith("Max Z = ") || line.startsWith("Max Z = ")) {
            const rightSide = line.split("=").map(part => part.trim())[1];
            const terms = rightSide.split("+").map(term => term.trim());
            terms.forEach(term => {
                const coeff = term.split("x")[0];
                if(!coeff) maxZ.push(1);
                else maxZ.push(+coeff);
            })
        } else {
            const constraint = [];
            const parts = line.split(/([<>]=?|=)/);

            const rhs = parts[parts.length - 1].trim();
            constraint.push(+rhs);

            const terms = parts[0].trim().split("+").map(term => term.trim());
            const temp = [];
            terms.forEach(term => {
                const [coeff, varNum] = term.split("x");
                temp.push(varNum);
                if(!coeff) constraint.push(1);
                else constraint.push(+coeff);
            })
            if(temp.length < maxZ.length) {
                for(let i = 0; i < maxZ.length; i++) {
                    if(!temp.includes(String(i+1))) constraint.splice(i+1,0,0);
                }
            }
            values.push(constraint);
        }
    })

    return [maxZ, values];
}

const defaultModel = `max z = 15x1 + 20x2 + 12x3
8x1 + 10x2 + 5x3 <= 2000
2x1 + 3x2 + 2x3 <= 665
x1 <= 200
x2 <= 300
x3 <= 150`;
const anotherDefaultModel = `max z = 300000x1 + 500000x2
2x1 <= 8
3x2 <= 15
6x1 + 5x2 <= 30`;

const variableInput = document.querySelector("#variable-input");
variableInput.value = defaultModel;

let ci, values, rawValues, currentValues, newValues;
let decisionVarTotal, constraintTotal, varTotal, allVar;
let basicVar, basicVarVal;
let zi, ciMinZi, ratio;
let key = {row: 0, col: 0}, keyVal;
let outterHTML;

document.querySelector(".variable-input__submit").addEventListener("click", e => {
    e.preventDefault();

    [ci, rawValues] = extractLPModel(variableInput.value);
    decisionVarTotal = ci.length;
    constraintTotal = rawValues.length;
    varTotal = decisionVarTotal + constraintTotal;

    for(let i = 0; i < rawValues.length; i++) {
        if(rawValues[i].length-1 < decisionVarTotal || rawValues[i].length-1 > decisionVarTotal) {
            alert("Variabel tidak valid!!!");
            return;
        }
    }

    allVar = [];
    for(let i = 0; i < decisionVarTotal; i++) {
        allVar.push(`x${i+1}`);
    }
    for(let i = 0; i < constraintTotal; i++) {
        allVar.push(`s${i+1}`);
    }

    for(let i = 0; i < constraintTotal; i++) ci.push(0);
    values = rawValues.map((subArray, index) => {
        const newArray = [...subArray];
        for(let i = 0; i < constraintTotal; i++) newArray.push(0);
        newArray[decisionVarTotal+1 + index] = 1;

        return newArray;
    })

    document.querySelector(".watermark").style.display = "none";

    solve();

    document.querySelector(".table__list").innerHTML = "";
    document.querySelector(".table__list").innerHTML = outterHTML;
})

function calcZi(values, basicVarVal) {
    let col = 0;
    const zi = [];

    while(col < values[0].length) {
        zi.push(0);
        for(let i = 0; i < basicVarVal.length; i++) {
            zi[col] += basicVarVal[i] * values[i][col];
        }
        col++;
    }

    return zi;
}

function calcCiMinZi(ci, zi) {
    const ciMinZi = [];
    for(let i = 0; i < ci.length; i++) {
        ciMinZi.push(ci[i] - zi[i+1]);
    }

    return ciMinZi;
}

function findExtremeIndex(values, findMax = true) {
    let extremeValue = null;
    let extremeIndex = -1;

    for(let i = 0; i < values.length; i++) {
        if(typeof values[i] != "number" || isNaN(values[i])) {
            continue;
        }
        if(extremeValue == null) {
            extremeValue = values[i];
            extremeIndex = i;
            continue;
        }

        if(findMax) {
            if(values[i] > extremeValue) {
                extremeValue = values[i];
                extremeIndex = i;
            }
        } else {
            if(values[i] < extremeValue && values[i] > 0) {
                extremeValue = values[i];
                extremeIndex = i;
            }
        }
    }

    return extremeIndex;
}

function getRatio(values, col) {
    const ratio = [];
    for(let i = 0; i < values.length; i++) {
        const denomerator = values[i][col];
        if(denomerator == 0) ratio.push("∞");
        else ratio.push(values[i][0] / values[i][col]);
    }
    return ratio;
}

function solve() {
    let iteration = 0;
    outterHTML = "";
    while(true) {
        if(iteration == 0) {
            currentValues = [...values];
            basicVar = [];
            basicVarVal = [];
            for(let i = 0; i < constraintTotal; i++) {
                basicVar.push(`s${i+1}`);
                basicVarVal.push(0);
            }
        } else {
            currentValues = [...newValues];
        }

        zi = calcZi(currentValues, basicVarVal);
        ciMinZi = calcCiMinZi(ci, zi);
        
        key.col = findExtremeIndex(ciMinZi)+1;
        ratio = getRatio(currentValues, key.col);
        key.row = findExtremeIndex(ratio, 0);
        keyVal = currentValues[key.row][key.col];
        
        console.log(`\n## Iterasi: ${iteration+1} ##`);
        console.log("Variabel dasar:");
        for(let i = 0; i < basicVar.length; i++) {
            console.log(`${basicVarVal[i]} → ${basicVar[i]}`);
        }
        console.log(currentValues);
        console.log(`Zi: ${zi.join(", ")}`);
        console.log(`Ci - Zi: ${ciMinZi.join(", ")}`);

        outterHTML += buildTable();

        newValues = [];
        for(let i = 0; i < currentValues.length; i++) {
            newValues.push([]);
            for(let j = 0; j < currentValues[i].length; j++) {
                if(i == key.row) {
                    newValues[i].push(currentValues[i][j] / keyVal);
                    continue;
                }

                const numerator = currentValues[i][key.col];
                newValues[i].push(currentValues[i][j] - ((numerator / keyVal) * currentValues[key.row][j]));
            }
        }

        basicVar[key.row] = allVar[key.col-1];
        basicVarVal[key.row] = ci[key.col-1];

        const isAllNegative = ciMinZi.every(val => val <= 0);
        if(isAllNegative) break;
        console.log(`Ratio: ${ratio.join(", ")}`);

        if(iteration == 19) break;
        iteration++;
    }
}

function numFormat(number) {
    if(Number.isInteger(number)) return new Intl.NumberFormat("id-ID").format(number);
    else return new Intl.NumberFormat("id-ID").format(number.toFixed(2))
}

function buildTable() {
    let html = "";
    html += "<table class='simplex-table' border='1'>";
    html += `
        <tr>
            <td>C<sub>i</sub></td>
            <td></td>
            <td></td>
    `;
    for(let i = 0; i < ci.length; i++) html += `<td>${numFormat(ci[i])}</td>`;
    html += "<td>Rasio</td>";
    html += "</tr>";

    html += `
        <tr>
            <td></td>
            <td></td>
            <td>K</td>
    `;
    for(let i = 0; i < allVar.length; i++) {
        const [symbol, symbolNum] = allVar[i].split("");
        html += `<td>${symbol}<sub>${symbolNum}</sub></td>`;
    }
    html += `
            <td></td>
        </tr>
    `;

    html += `
        <tr>
            <td></td>
            <td>Variabel dasar</td>
            <td>q</td>
    `;
    for(let i = 0; i < ci.length+1; i++) html += "<td></td>";
    html += "</tr>";

    for(let i = 0; i < constraintTotal; i++) {
        html += "<tr>";
        for(let j = 0; j < 2 + currentValues[0].length + 1; j++) {
            if(j == 0) {
                html += `<td>${numFormat(basicVarVal[i])}</td>`;
            } else if(j == 1) {
                const [symbol, symbolNum] = basicVar[i].split("")
                html += `<td>${symbol}<sub>${symbolNum}</sub></td>`;
            } else if(j == 2 + currentValues[0].length) {
                if(!isNaN(ratio[i])) {
                    html += `<td>${numFormat(ratio[i])}</td>`;
                }
                else html += `<td>${ratio[i]}</td>`;
            } else {
                const cls = i == key.row && j-2 == key.col ? `key-val"` : "";
                html += `<td class="${cls}">${numFormat(currentValues[i][j-2])}</td>`;
            }
        }
        html += "</tr>";
    }

    html += `
        <tr>
            <td></td>
            <td>Z<sub>i</sub></td>
    `;
    for(let i = 0; i < zi.length; i++) {
        html += `<td>${numFormat(zi[i])}</td>`;
    }
    html += "</tr>";

    html += `
        <tr>
            <td></td>
            <td>Z<sub>i</sub> - C<sub>i</sub></td>
            <td></td>
    `;

    for(let i = 0; i < ciMinZi.length; i++) {
        html += `<td>${numFormat(ciMinZi[i])}</td>`;
    }

    html += "</tr>";
    html += "</table>";

    return html;
}