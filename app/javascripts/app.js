// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

/*
 * When you compile and deploy your Voting contract,
 * truffle stores the abi and deployed address in a json
 * file in the build directory. We will use this information
 * to setup a Voting abstraction. We will use this abstraction
 * later to create an instance of the Voting contract.
 * Compare this against the index.js from our previous tutorial to see the difference
 * https://gist.github.com/maheshmurthy/f6e96d6b3fff4cd4fa7f892de8a1a1b4#file-index-js
 */

import voting_artifacts from '../../build/contracts/Voting.json'

var Voting = contract(voting_artifacts);

let candidates = {}

let tokenPrice = null;
window.voteForCandidate = function(candidate) {
  let candidateName = $("#candidate").val();
  let voteTokens = $("#vote-tokens").val();
  $("#msg").show();
  $("#msg").attr('class', 'alert alert-dismissible alert-info');
  $("#msg").html("Vote has been submitted. The vote count will increment as soon as the vote is recorded on the blockchain. Please wait.")
  $("#candidate").val("");
  $("#vote-tokens").val("");

  /* Voting.deployed() returns an instance of the contract. Every call
   * in Truffle returns a promise which is why we have used then()
   * everywhere we have a transaction call
   */
  Voting.deployed().then(function(contractInstance) {
    contractInstance.voteForCandidate(candidateName, voteTokens, {from: web3.eth.accounts[0]}).then(function() {
        // If this callback is called, the transaction was successfully processed.
        // Note that Ether Pudding takes care of watching the network and triggering
        // this callback.
        let div_id = candidates[candidateName];
        return contractInstance.totalVotesFor.call(candidateName).then(function(v) {
          $("#" + div_id).html(v.toString());
          $("#msg").hide();
          $("#msg").html("");
        }).catch(function(e) {
          $("#msg").show();
          $("#msg").attr('class', 'alert alert-dismissible alert-danger');
          $("#msg").html(e.message);
        });
        
        console.log("Transaction successful!")
    }).catch(function(e) {
        $("#msg").show();
        $("#msg").attr('class', 'alert alert-dismissible alert-danger');
        $("#msg").html(e.message);
        console.log(e)
    })
  });
/*
Voting.deployed().then(function(contractInstance) {
  contractInstance.voteForCandidate(candidateName, voteTokens, {gas: 140000, from: web3.eth.accounts[0]}).then(function() {
    let div_id = candidates[candidateName];
    return contractInstance.totalVotesFor.call(candidateName).then(function(v) {
      $("#" + div_id).html(v.toString());
      $("#msg").html("");
    }).catch(function(e) {
      $("#msg").html(e);
      // There was an error! Handle it.  
    });
  });
});
*/

}

/* The user enters the total no. of tokens to buy. We calculate the total cost and send it in
 * the request. We have to send the value in Wei. So, we use the toWei helper method to convert
 * from Ether to Wei.
 */

window.buyTokens = function() {
  let tokensToBuy = $("#buy").val();
  let price = tokensToBuy * tokenPrice;
  $("#buy-msg").html("Purchase order has been submitted. Please wait.");
  $("#buy-msg").show();
  Voting.deployed().then(function(contractInstance) {
    contractInstance.buy({value: web3.toWei(price, 'ether'), from: web3.eth.accounts[0]}).then(function(v) {
      $("#buy-msg").html("");
      $("#buy-msg").hide();
      web3.eth.getBalance(contractInstance.address, function(error, result) {
        $("#contract-balance").html(web3.fromWei(result.toString()) + " Ether");
      });
      populateTokenData();
    })
  });
 
}

window.lookupVoterInfo = function() {
  let address = $("#voter-info").val();
  Voting.deployed().then(function(contractInstance) {
    contractInstance.voterDetails.call(address).then(function(v) {
      $("#tokens-bought").show();
      $("#tokens-bought").html("Total Tokens bought: " + v[0].toString());
      let votesPerCandidate = v[1];
      $("#votes-cast").empty();
      $("#votes-cast").append("Votes cast per candidate: <br>");
      let allCandidates = Object.keys(candidates);
      for(let i=0; i < allCandidates.length; i++) {
        $("#votes-cast").append(allCandidates[i] + ": " + votesPerCandidate[i] + "<br>");
      }
    });
  });
}

/* Instead of hardcoding the candidates hash, we now fetch the candidate list from
 * the blockchain and populate the array. Once we fetch the candidates, we setup the
 * table in the UI with all the candidates and the votes they have received.
 */
function populateCandidates() {
  Voting.deployed().then(function(contractInstance) {
    contractInstance.allCandidates.call().then(function(candidateArray) {
      for(let i=0; i < candidateArray.length; i++) {
        /* We store the candidate names as bytes32 on the blockchain. We use the
         * handy toUtf8 method to convert from bytes32 to string
         */
        candidates[web3.toUtf8(candidateArray[i])] = "candidate-" + i;
      }
      setupCandidateRows();
      populateCandidateVotes();
      populateTokenData();
    });
  });
}

function populateCandidateVotes() {
  let candidateNames = Object.keys(candidates);
  for (var i = 0; i < candidateNames.length; i++) {
    let name = candidateNames[i];
    Voting.deployed().then(function(contractInstance) {
      contractInstance.totalVotesFor.call(name).then(function(v) {
        $("#" + candidates[name]).html(v.toString());
      });
    });
  }
}

function setupCandidateRows() {
  Object.keys(candidates).forEach(function (candidate) { 
    $("#candidate-rows").append("<tr><td>" + candidate + "</td><td id='" + candidates[candidate] + "'></td></tr>");
  });
}

/* Fetch the total tokens, tokens available for sale and the price of
 * each token and display in the UI
 */
function populateTokenData() {
  Voting.deployed().then(function(contractInstance) {
    contractInstance.totalTokens().then(function(v) {
      $("#tokens-total").html(v.toString());
    });
    contractInstance.tokensSold.call().then(function(v) {
      $("#tokens-sold").html(v.toString());
    });
    contractInstance.tokenPrice().then(function(v) {
      tokenPrice = parseFloat(web3.fromWei(v.toString()));
      $("#token-cost").html(tokenPrice + " Ether");
    });
    web3.eth.getBalance(contractInstance.address, function(error, result) {
      $("#contract-balance").html(web3.fromWei(result.toString()) + " Ether");
    });
  });
}

$( document ).ready(function() {
  $("#buy-msg").hide();
  $("#msg").hide();
  $("#tokens-bought").hide();
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source like Metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }

  Voting.setProvider(web3.currentProvider);
  populateCandidates();

  web3.eth.getAccounts(function(error, accounts){
    getTransactionsByAccount(accounts[0]);

  });
});

function getTransactionsByAccount(myaccount) {
  var filter = web3.eth.filter('latest');
  filter.watch(function (error, blockash) {
    console.log("Searching block from hash : " + blockash);
    web3.eth.getBlock(blockash, function(error, block){
      if(!error){
        if (block != null && block.transactions != null) {
          block.transactions.forEach( function(transactionHash) {
            web3.eth.getTransaction(transactionHash, function(error, e){
              if (myaccount == "*" || myaccount == e.from || myaccount == e.to) {

                $("#transactions > tbody").append("<tr class='info'><td>tx hash</td><td>" + e.hash + " ("+ new Date(block.timestamp * 1000).toGMTString() +")</td></tr>");
                $("#transactions > tbody").append("<tr><td>nonce</td><td>" + e.nonce + "</td></tr>");
                $("#transactions > tbody").append("<tr><td>blockHash</td><td>" + e.blockHash + "</td></tr>");
                $("#transactions > tbody").append("<tr><td>blockNumber</td><td>" + e.blockNumber + "</td></tr>");
                $("#transactions > tbody").append("<tr><td>from -> to</td><td>" + e.from + " -> " + e.to +"</td></tr>");
                $("#transactions > tbody").append("<tr><td>value</td><td>" + e.value + "</td></tr>");
                  
                $("#transactions > tbody").append("<tr><td>gasPrice</td><td>" + e.gasPrice + "</td></tr>");
                $("#transactions > tbody").append("<tr><td>gas</td><td>" + e.gas +"</td></tr>");
                $("#transactions > tbody").append("<tr><td>input</td><td>" + e.input + "</td></tr>");
                console.log("  tx hash          : " + e.hash + "\n"
                  + "   nonce           : " + e.nonce + "\n"
                  + "   blockHash       : " + e.blockHash + "\n"
                  + "   blockNumber     : " + e.blockNumber + "\n"
                  + "   transactionIndex: " + e.transactionIndex + "\n"
                  + "   from            : " + e.from + "\n" 
                  + "   to              : " + e.to + "\n"
                  + "   value           : " + e.value + "\n"
                  + "   time            : " + block.timestamp + " " + new Date(block.timestamp * 1000).toGMTString() + "\n"
                  + "   gasPrice        : " + e.gasPrice + "\n"
                  + "   gas             : " + e.gas + "\n"
                  + "   input           : " + e.input);
              }
            });
          })
        }
      } else {
          console.error(error);
      }
    });
  });
}
