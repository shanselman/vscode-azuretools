/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as os from 'os';
import * as vscode from 'vscode';
import { localize } from '../localize';

export namespace cpUtils {
    export async function executeCommand(outputChannel: vscode.OutputChannel | undefined, workingDirectory: string | undefined, command: string, commandOptions?: CommandOptions, ...args: string[]): Promise<string> {
        const result: ICommandResult = await tryExecuteCommand(outputChannel, workingDirectory, command, commandOptions, ...args);
        if (result.code !== 0) {
            // We want to make sure the full error message is displayed to the user, not just the error code.
            // If outputChannel is defined, then we simply call 'outputChannel.show()' and throw a generic error telling the user to check the output window
            // If outputChannel is _not_ defined, then we include the command's output in the error itself and rely on AzureActionHandler to display it properly
            if (outputChannel) {
                outputChannel.show();
                throw new Error(localize('azFunc.commandErrorWithOutput', 'Failed to run "{0}" command. Check output window for more details.', command));
            } else {
                throw new Error(localize('azFunc.commandError', 'Command "{0} {1}" failed with exit code "{2}":{3}{4}', command, result.formattedArgs, result.code, os.EOL, result.cmdOutputIncludingStderr));
            }
        } else {
            if (outputChannel) {
                outputChannel.appendLine(localize('finishedRunningCommand', 'Finished running command: "{0} {1}".', command, result.formattedArgs));
            }
        }
        return result.cmdOutput;
    }

    export async function tryExecuteCommand(outputChannel: vscode.OutputChannel | undefined, workingDirectory: string | undefined, command: string, commandOptions?: CommandOptions, ...args: string[]): Promise<ICommandResult> {
        return await new Promise((resolve: (res: ICommandResult) => void, reject: (e: Error) => void): void => {
            let cmdOutput: string = '';
            let cmdOutputIncludingStderr: string = '';
            const formattedArgs: string = args.join(' ');

            workingDirectory = workingDirectory || os.tmpdir();
            const options: cp.SpawnOptions = {
                cwd: workingDirectory,
                shell: true
            };

            const childProc: cp.ChildProcess = cp.spawn(command, args, options);
            let runningCommand: string = localize('runningCommand', 'Running command: "{0} {1}"...', command, formattedArgs);
            if (outputChannel) {
                if (commandOptions && commandOptions.obfuscateValue) {
                    runningCommand = obfuscateValue(runningCommand, commandOptions.obfuscateValue);
                }
                outputChannel.appendLine(runningCommand);
            }

            childProc.stdout.on('data', (data: string | Buffer) => {
                data = data.toString();
                if (commandOptions && commandOptions.obfuscateValue) {
                    data = obfuscateValue(data, commandOptions.obfuscateValue);
                }
                cmdOutput = cmdOutput.concat(data);
                cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
                if (outputChannel) {
                    outputChannel.append(data);
                }
            });

            childProc.stderr.on('data', (data: string | Buffer) => {
                data = data.toString();
                if (commandOptions && commandOptions.obfuscateValue) {
                    data = obfuscateValue(data, commandOptions.obfuscateValue);
                }
                cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
                if (outputChannel) {
                    outputChannel.append(data);
                }
            });

            childProc.on('error', reject);
            childProc.on('close', (code: number) => {
                resolve({
                    code,
                    cmdOutput,
                    cmdOutputIncludingStderr,
                    formattedArgs
                });
            });
        });
    }

    function obfuscateValue(data: string, value: string): string {
        let astericks: string = '';
        for (const _i of value) {
            astericks += '*';
        }
        return data.replace(value, astericks);
    }

    export interface ICommandResult {
        code: number;
        cmdOutput: string;
        cmdOutputIncludingStderr: string;
        formattedArgs: string;
    }

    export type CommandOptions = {
        obfuscateValue?: string
    };
}