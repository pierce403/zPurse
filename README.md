## Overview 
At a high level, the zPurse protocol enables an account based payment system (such as Ethereum) to convert assets into a UTXO based accounting system in a smart contract using notes with cloaked owners and amounts, while using zk proofs to verify UTXO transitions.

What this looks like is a smart contract on Ethereum with a mapping from note ID to a hash of note metadata. The metadata for a note simply contains the balance of the note, and the address of who can spend it. The contract then has one public function called updateNotes that takes in a list of old notes, a list of new notes, and a proof that the transition is valid.

## Motivations
The initial motivation for this work came from the realization that messaging protocols have matured to the point where payment signaling can be delegated to out of band transport layers. 

By decoupling this requirement, you suddenly can gain all sorts of interesting privacy properties, as well as properties that enable things like offline transactions and physical payment tokens, with assets sitting on any number of networks, that can all be trivially abstracted away from the UX of less technical users. This document hopes to describe a simplified early version of what might be accomplished in the future.

There exists a dilemma where secure payments require strong identity bindings to the reciever of any funds being sent, but payments are rarely intended to be visible to the general public. How do we allow users to have some sense of personal privacy while also ensuring that recipients aren't impersonators, or other types of scammers?

## Goals
I want to outline a very simple protocol where anyone with an armchair cryptographer level of understanding can fully conceptualize the security properties of the system.

Users with funds in the system should be able to easily transfer funds to anyone with an Ethereum address. For simplicity of the initial design, only EOAs are considered, though smart contracts could probably be enabled easily enough.

## Anti-Goals
This spec is fully non opinionated about the zk proving system in use. For the sake of simplicity, a system like RiscZero that can do verifiable computation on arbitrary rust code might be the easiest to conceptualize.

I don't really care about performance. It would be nice if users could prove note updates on their phones in under a minute or so, but proving costs nor contract gas costs are considered here.

In general, there is no on-chain way for a user to detect when they have received a note. This is a feature.

## Deposits and Withdrawals
The updateNotes function has an optional field for regular ERC-20 inputs or outputs. The user would construct an updateNote transaction indicating the number of assets, lets say DAI, that they want to move into the Purse. They would then also submit an empty list of input notes and a short list of output notes, with themselves as the spender on those notes. There are also situations where someone might want to deposit directly to another spender. Of course ERC-20 funds could be withdrawn at any time as well.

## Sending and Receiving Funds
When a user wants to send funds, first they find a set of input notes with the required amount of funding. They must control the EOA private key for the spender of any notes that are used. They then construct a set of output notes setting the proper spenders and amounts accordingly. One of the notes might be the destination for the funds, and another might be a change address to deposit any leftover funds. Another might be a tip for an external party to commit the update to the chain. Notice this is very similar to how Bitcoin constructs transactions in the UTXO model, where the output notes are the unspent transaction outputs.

Once the input and output notes are decided, the user then creates a zero knowledge proof (described in the next section) that the inputs and outputs represent a legitimate note transition. That set of inputs, outputs, and the proof is known as the NoteUpdate.

At this point, the NoteUpdate can be committed directly to the Purse by the user, send to a NoteUpdate Aggregator, or sent directly to the intended recipient of the funds. Either way, the recipient must also then be informed that they have received funds. How this is communicated is out of scope for this spec, but for the purposes of this example you can imagine a message being sent over the XMTP network saying "you have a new note", and including the note id, the spender address, the balance of the note, and the nonce.

The recipient will then be able to hash the metadata together, and query the state of the contract directly to confirmed that they do, in fact, own that new note. If the user has received an Uncommitted Note, they can verify the proof and that one of the output notes contains the intended funds. They would then have the option to commit the NoteUpdate themselves.

Of course this entire process would be hidden by a simple UX where a user simply sends a transaction just like they would in any other payment app.

## Proving
The exact details of the proving zero knowledge proving scheme are out of scope for this document, but the conceptual black box is a prover with a set of inputs, a set of outputs, a program to run on the inputs, and a receipt that proves execution was done correctly.

In this case, the inputs include the input and output notes, including all of the note metadata (spender, balance, nonce), as well as a signature from the spender proving that they hold the spending key.

### Prove the Spender

First, we need to prove that the designated spender is the one generating the proof. We want to make sure that any zPurse client doesn't actually need the private key, so the signature should come from any normal Web3 wallet, such as Metamask. The data being signed should be a hash of all relevant input and output notes, not including the spender.

Inside the prover, all we're doing is a normal ERC???? signature check, but we also need to make sure that we hash the notes as well to confirm that the signature is commiting to the right set of notes.

### Prove the Meta Hashes

It is important to confirm that all of the metadata sent in actually Hashes to the MetaHash field on the input and output notes themselves.

### Prove the Notes are Balanced

It is important to confirm that the sum of the balances of the input notes exactly equal the sum of the balances of the output notes.

### Return the Results

Now we can return all of the notes, without the metadata attached, and the execution receipt that proves all the checks were performed correctly. Notice that there is no information about the spender in the final NoteUpdate.

### Potential for Recursion 

This proving scheme could also add the option of including any number of previously proven NoteUpdates by calling the verifier from inside the prover. This means that thousands of  input and output notes with any number of spenders could be aggregated into a single NoteUptate. It is important to keep in mind, however, that every input note in the NoteUpdate must match the meta hash value in the registry, or the entire NoteUpdate will be invalid and will not be able to be committed.

## Tipping Conventions

For the sake of operational security, users should generally refrain from committing their own note updates. Instead they can designate one of their OutputNotes as TipNote to a specific "Note Aggregator", who would be the one actually responsible for committing the note to the chain.

If a user isn't confident that the Aggregator will submit their NoteUpdate in a timely manner, they might generate multiple NoteUpdates with tips to different aggregators which would only be valid for the first aggregator that submits it.

## Offline Note Transfers

Notice that nothing in this system requires the sender or receiver of funds to be online. In a scenario where there is some social trust, as is common with in-person interactions, the sender could send a NoteUpdate and the Note Metadata to the recipient via QR code, or bluetooth, or whatever other message sending is available. The recipient's wallet could then verify the proof, and verify the input notes against the last known state of the Purse contract. These funds could be double-spent until the NoteUpdate is able to be broadcast and committed, so it should not be used in low-trust situations.

This same mechanism could enable the use of NFC based physical coins. A note would be created where the spender key is in the NFC chip itself. A phone with the recent state of the NoteRegistry could use the NFC reader to confirm the legitimacy of the coin. If the coin is illegitimately duplicated it would be immediately apparent once the Note is spent. Coins would be passed around mostly in scenarios where some social trust is involved, and would likely be spent immediately when used in a low-trust environment, such as when spent at a retail establishment. The coins could then be regularly reloaded and reused.

## Social Backup

Someone who loses access to their list of notes would no longer be able to spend them. Since zPurse payment identities are just web3 identities, the web3 social graph (Farcaster, Lens, etc) of any user can be leveraged to back up notes. The stack of notes should be encrypted, and sufficiently padded so that the number of notes is difficult to ascertain, but it is also interesting that even if that user manages to decrypt the bundle, they would still not be able to spend any of the notes without the spending key.  

## Privacy Properties

Unlike many other payment systems, the receiver of funds is generally unaware of who sent them. A wallet would likely mark the sender as whatever entity made them aware of the note, which may or may not be the one who actually sent the funds. Interestingly, this also means that a potential recipient can make a payment request, asking anyone to create a new note with a given sender, balance, and nonce. That way, the sender does not need to figure out how to inform the recipient of the transfer. The recipient will just be made aware of the successful transfer once the note shows up in the registry. Since the registry can be accessed by smart contracts on the same blockchain network, this could potentially be used for various automation use cases.

## Note States
* Illegitimate: Even with a NoteUpdate, the Note Meta does not map to a legitimate Note
* Unconfirmed: A bundled NoteUpdate has a verified proof, and matching OutputNote, but the NoteID is not in the registry yet
* Confirmed: The NoteID exists in the registry, and the hash of the metadata matches the public MetaHash.
* Spent: The Note was valid, but has been spent.

## Mobile App Considerations
* No need for private key! Just set spender.
* Point to any number of purses on any number of chains and abstract transactions away.
* Should also be an XMTP client.

## Limitations 
* Two unconfirmed transactions can't be aggregated in the same batch.
* UTXO Forensics is a thing.
* No fancy smart contracts.

## Concerns

Each purse instance holds all the underlying assets for all users, and if the Verifier can be tricked into verifying a forged transaction, an attacker can take all the money out. It's basically a giant money pinata.

## Emergency Exits

In the event of a critical soundness bug in the verifier, a Whitehat could craft a transaction that would remove more funds than actually exist in the contract. In that case, the Purse would go into emergency mode. No more deposits or note updates would be allowed, and people would be able to safely withdraw their funds.

## Future

It would be simple to add a token id so any given purse could also hold arbitrary ERC20 tokens.

Note updates could be proven recursively, effectively aggregating any number of note transitions into a single update. An Update Aggregator would prove their own input and output notes, and then as part of their proof, verify any number of other noteTxProofs.

Purses with different verifiers could be set up to perform transfers between each other, perhaps even cross chain using LayerZero or any other system that supports cross chain message passing.

It would be nice to enable contracts to be note owners, for purposes of account abstraction as well as potentially enabling certain DeFi use cases.

I have been told that Fully Homomorphic Encryption might allow for the entire note registry to be hidden, so an outside observer would not be able to see what notes are being operated on. It's unclear to me if this would make note observability overly complicated for receivers of notes.

Should this be an ERC?

## Glossary

* Purse: This is the smart contract. It holds all the assets for all the users. Is has a NoteRegistry, a function to update the notes, and a zk verifier to verify note transitions.
* Note: This is the standard unit of value in the zPurse system.
* NoteRegistry: This is public mapping on the contract from NoteID to NoteMetaHash. No other details about the notes can be seen publicly.
* NoteID: This is an integer value representing a note. It is public, and ideally random so users don't accidentally create conflicting output notes.
* NoteMetaHash: Publicly visible hash of the spender, balance, and nonce.
* Spender : This is a web3 EOA who has permission to spend a note.
* Balance : How much of an asset is sitting in a note.
* Nonce : Random number to prevent the brute forcing of NoteMetaHash's, since the other two fields can be relatively low entropy.

## Call for Participation

This is a very early draft. Most of which was typed out on a phone while on an airplane. There are likely several typos and inconsistencies. Any protips on how to make mdbook sites look pretty would be awesome.

Leave issues on GitHub, and send pull requests. Any feedback is greatly appreciated. 

https://github.com/pierce403/zPurse

## Inspiration

Bitcoin, Zero Cash, Tornado Cash, and especially Aztec's join-split note mechanism. Of course none of this would be practical today without the fine work happening on Ethereum, XMTP, Farcaster, and RiscZero as well.
