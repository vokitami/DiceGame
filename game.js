const args = process.argv.slice(2);
const parsedArgs = args.map(diceStr => diceStr.split(',').map(Number));
const crypto = require('crypto');
const readline = require('readline');
const table = require('cli-table3');

class SecretNumber{
    constructor(){
        this.numbers = [0,1];
    }

    getNumber(){
        const i = Math.floor(Math.random() * this.numbers.length);
        return this.numbers[i];
    }
}

class Hmac{
    static generateKey(){
        return crypto.randomBytes(16).toString('hex');
    }

    static generateHmac(key, message){
        return crypto.createHmac('sha3-256', key)
                     .update(String(message))
                     .digest('hex');
    }
}

const Table = require('cli-table3');

class ProbabilityTable {
    static formatDice(diceArray) {
        return diceArray.join(',');
    }

    static calculateWinProbability(diceA, diceB) {
        let wins = 0;
        let total = 0;

        for (let a of diceA) {
            for (let b of diceB) {
                if (a > b) wins++;
                total++;
            }
        }

        return (wins / total).toFixed(4);
    }

    static renderProbabilityTable(diceList) {
        const headers = ['User dice v', ...diceList.map(this.formatDice)];

        const table = new Table({
            head: headers,
            style: { head: ['cyan'], border: ['gray'] },
            colWidths: headers.map(h => Math.max(13, h.length + 2)),
            wordWrap: true,
            colAligns: ['center', ...Array(diceList.length).fill('center')],
            chars: {
                'top': '-',
                'top-mid': '+',
                'top-left': '+',
                'top-right': '+',
                'bottom': '-',
                'bottom-mid': '+',
                'bottom-left': '+',
                'bottom-right': '+',
                'left': '|',
                'left-mid': '+',
                'mid': '-',
                'mid-mid': '+',
                'right': '|',
                'right-mid': '+',
                'middle': '|'
            }
        });

        diceList.forEach((userDice, rowIdx) => {
            const row = [this.formatDice(userDice)];
            diceList.forEach((opponentDice, colIdx) => {
                if (rowIdx === colIdx) {
                    row.push('.𝟹𝟹𝟹𝟹'); //special diagonal
                } else {
                    const prob = this.calculateWinProbability(userDice, opponentDice);
                    row.push(`.${prob}`);
                }
            });
            table.push(row);
        });

        console.log('\nProbability of the win for the user:');
        console.log(table.toString());
    }
}

module.exports = ProbabilityTable;

class FirstMove{
    constructor(secretNumber, key, hmac){
        this.secretNumber = secretNumber;
        this.key = key;
        this.hmac = hmac;
        this.isWinner = true;
    }

    evaluate(userGuess){
        if(userGuess !== 0 && userGuess !==1){
                console.log('\nInvalid input. Please enter 0 or 1.');
            }else if(userGuess === this.secretNumber){
                this.isWinner = true;
                console.log(`You're rigth!\nMy selection: ${this.secretNumber}\nYour selection: ${userGuess}`);
            }else{
                this.isWinner = false;
                console.log(`You're wrong.\nMy selection: ${this.secretNumber}\nYour selection: ${userGuess}`);
            }

            console.log(`KEY: ${this.key}`);

            const verifyHmac = Hmac.generateHmac(this.key, this.secretNumber);
            if(verifyHmac === this.hmac){
                console.log(`HMAC verified: the secret number and key are valid.\n`);
            }else{
                console.log("HMAC verification failed: data may have been tampered.\n");
            }
    }
}

class ParseValidateArgs{
    constructor(args){
        this.args = args;
    }

    validate(){
        if(this.args.length < 3){
            throw new Error('\nError: At least 3 dice are required.\nExample: node game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3 \n');
        }

        for(let i = 0; i < this.args.length; i++){
            const diceFaces = this.args[i].split(',').map(Number);
            
            if(diceFaces.some(face => isNaN(face))){
                throw new Error(`\nError: Dice #${i + 1} contains non-integer values.\nExample: node game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3 \n`);
            
            }
        }
    }
}

class SelectDice {
    constructor(isWinner, args, rl) {
        this.winner = isWinner;
        this.diceOptions = args;
        this.rl = rl;
        this.computerChoice = Math.floor(Math.random() * this.diceOptions.length);
    }

    pickDice(callback) {
    if (this.winner) {
        console.log(`You won the right to choose a dice!\nAvailable dice:`);
        this.diceOptions.forEach((diceStr, i) => {
            console.log(`${i} - ${diceStr}`);
        });
        console.log("X - exit");
        console.log("? - help");

        this.rl.question('Choose your dice (enter number): ', (answer) => {
            if (answer.toUpperCase() === 'X') return this.rl.close();
            if (answer === '?') {
                console.log(`
Help:
- Enter the number corresponding to the dice you want to use.
- 'X' to exit the game.
- '?' to show this help menu again.\n`);
ProbabilityTable.renderProbabilityTable(parsedArgs);
                console.log('\n');
                return this.pickDice(callback);
            }

            const userChoice = Number(answer);
            if (isNaN(userChoice) || userChoice < 0 || userChoice >= this.diceOptions.length) {
                console.log('\nInvalid choice. Try again.');
                return this.pickDice(callback);
            }

            let computerChoice = this.computerChoice;
            if (computerChoice === userChoice) {
                for (let i = 0; i < this.diceOptions.length; i++) {
                    if (i !== userChoice) {
                        computerChoice = i;
                        break;
                    }
                }
            }

            console.log(`\nYou chose dice: ${userChoice} - ${this.diceOptions[userChoice]}`);
            console.log(`Computer chose dice: ${computerChoice} - ${this.diceOptions[computerChoice]}`);

            callback(computerChoice, userChoice);
        });

    } else {
        console.log(`I make the first move and choose the ${this.computerChoice} - ${this.diceOptions[this.computerChoice]} dice.`);
        console.log('Available dice:');
        this.diceOptions.forEach((diceStr, i) => {
            if (i !== this.computerChoice) {
                console.log(`${i} - ${diceStr}`);
            }
        });
        console.log("X - exit");
        console.log("? - help");

        this.rl.question('Choose your dice (enter number): ', (answer) => {
            if (answer.toUpperCase() === 'X') return this.rl.close();
            if (answer === '?') {
                console.log(`
Help:
- Enter the number corresponding to the dice you want to use (excluding the one I chose).
- 'X' to exit the game.
- '?' to show this help menu again.\n`);
ProbabilityTable.renderProbabilityTable(parsedArgs);
                console.log('\n');
                return this.pickDice(callback); 
            }

            const userChoice = Number(answer);
            if (isNaN(userChoice) || userChoice < 0 || userChoice >= this.diceOptions.length || userChoice === this.computerChoice) {
                console.log('\nInvalid choice. Try again.');
                return this.pickDice(callback);
            }

            console.log(`\nComputer chose dice: ${this.computerChoice} - ${this.diceOptions[this.computerChoice]}`);
            console.log(`You chose dice: ${userChoice} - ${this.diceOptions[userChoice]}`);

            callback(this.computerChoice, userChoice);
        });
    }
}

}

class RollDice {
    constructor(computerDiceIndex, userDiceIndex, rl, diceOptions) {
        this.computerDiceIndex = computerDiceIndex;
        this.userDiceIndex = userDiceIndex;
        this.rl = rl;
        this.diceOptions = diceOptions;
    }

    choices() {
    const computerDiceFaces = this.diceOptions[this.computerDiceIndex];
    const userDiceFaces = this.diceOptions[this.userDiceIndex];

    const computerSecret = Math.floor(Math.random() * 6);
    const computerKey = Hmac.generateKey();
    const hmac = Hmac.generateHmac(computerKey, computerSecret);

    console.log(`\nIt's time for my roll.`);
    console.log(`I selected a random value in the range 0..5 (HMAC=${hmac}).`);
    console.log(`Add your number modulo 6.`);
    console.log(`0 - 0\n1 - 1\n2 - 2\n3 - 3\n4 - 4\n5 - 5\nX - exit\n? - help\n`);

    this.rl.question("Your selection: ", (input) => {
        if (input.toUpperCase() === 'X') return this.rl.close();
        if (input === '?') {
            console.log('Help: Select a number from 0 to 5. It will be added to my secret number and mod 6 applied to get the dice face.');
            return this.choices(); 
        }

        const userInput = Number(input);
        if (isNaN(userInput) || userInput < 0 || userInput > 5) {
            console.log('Invalid input.');
            return this.choices();
        }

        const combined = (computerSecret + userInput) % 6;
        const computerRoll = computerDiceFaces[combined];

        console.log(`My number is ${computerSecret} (KEY=${computerKey})`);
        console.log(`The fair number generation result is ${computerSecret} + ${userInput} = ${combined} (mod 6).`);
        console.log(`My roll result is ${computerRoll}.\n`);

        this.userRoll(userDiceFaces);
    });
}

userRoll(userDiceFaces) {
    const userSecret = Math.floor(Math.random() * 6);
    const userKey = Hmac.generateKey();
    const hmac = Hmac.generateHmac(userKey, userSecret);

    console.log(`It's time for your roll.`);
    console.log(`I selected a random value in the range 0..5 (HMAC=${hmac}).`);
    console.log(`Add your number modulo 6.`);
    console.log(`0 - 0\n1 - 1\n2 - 2\n3 - 3\n4 - 4\n5 - 5\nX - exit\n? - help\n`);

    this.rl.question("Your selection: ", (input) => {
        if (input.toUpperCase() === 'X') return this.rl.close();
        if (input === '?') {
            console.log('Help: Select a number from 0 to 5. It will be added to my secret number and mod 6 applied to get the dice face.');
            return this.userRoll(userDiceFaces); 
        }

        const userInput = Number(input);
        if (isNaN(userInput) || userInput < 0 || userInput > 5) {
            console.log('Invalid input.');
            return this.userRoll(userDiceFaces);
        }

        const combined = (userSecret + userInput) % 6;
        const userRoll = userDiceFaces[combined];

        console.log(`My number is ${userSecret} (KEY=${userKey})`);
        console.log(`The fair number generation result is ${userSecret} + ${userInput} = ${combined} (mod 6).`);
        console.log(`Your roll result is ${userRoll}.\n`);

        this.declareWinner(userRoll);
    });
}

declareWinner(userRoll) {
    const computerDiceFaces = this.diceOptions[this.computerDiceIndex];
    const userDiceFaces = this.diceOptions[this.userDiceIndex];
    const computerRoll = computerDiceFaces.find(face => face !== undefined); 

    if (userRoll > computerRoll) {
        console.log("You win!");
    } else if (userRoll < computerRoll) {
        console.log("Computer wins.");
    } else {
        console.log("It's a tie!");
    }

    this.rl.close();
}
}

class Main{
    constructor(){
        this.SecretNumber = null;
        this.key = null;
        this.hmac = null;
        this.secret = new SecretNumber();
        this.rl = readline.createInterface({
            input: process.stdin,
            output:process.stdout
        });
    }
    
    start(){
        try {
            const validator = new ParseValidateArgs(args);
            validator.validate();
        } catch (error) {
            console.error(error.message);
            this.rl.close();  
            process.exit(1);   
        }

        const validator = new ParseValidateArgs(args);
        validator.validate();

        this.SecretNumber = this.secret.getNumber();
        this.key = Hmac.generateKey();
        this.hmac = Hmac.generateHmac(this.key, this.SecretNumber);

        console.log("Let's determine who makes the first move.\nI selected a random value in the range 0..1.");
        console.log(`(HMAC: ${this.hmac})\nTry to guess my selection.`);
        console.log("0 - 0\n1 - 1\nX - exit\n? - help\n");

        this.rl.question('Enter your guess (0 or 1): ', (answer) => {
             const userGuess = Number(answer);
            if (answer.toUpperCase() === "X") {
                console.log("Exiting game.");
                return this.rl.close();
            } else if (answer === "?") {
                console.log(`
How to play:
- Choose a dice when it's your turn.
- Pick a number (0-5) to complete the fair roll.
- Each round is secured with HMAC to ensure fairness.
- Press X to exit anytime, or ? to see this help again.
                                    \n`);
                ProbabilityTable.renderProbabilityTable(parsedArgs);
                console.log('\n');
                return this.start();
            }

            const evaluator = new FirstMove(this.SecretNumber, this.key, this.hmac);
            evaluator.evaluate(userGuess);

            const diceSelector = new SelectDice(evaluator.isWinner, parsedArgs, this.rl);
            diceSelector.pickDice((computerChoice, userChoice) => {

                const round = new RollDice(computerChoice, userChoice, this.rl,parsedArgs);
                round.choices();
            });       
        })
    }
}

const main = new Main();
main.start();